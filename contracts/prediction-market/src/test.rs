#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token, Address, Env, String,
};

struct Fixture<'a> {
    e: Env,
    client: PredictionMarketClient<'a>,
    token: token::Client<'a>,
    treasury: Address,
}

fn setup<'a>(fee_bps: u32) -> Fixture<'a> {
    let e = Env::default();
    e.mock_all_auths();
    e.ledger().set_timestamp(1_000);

    let token_admin = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(token_admin.clone());
    let token_addr = sac.address();
    let token = token::Client::new(&e, &token_addr);

    let admin = Address::generate(&e);
    let treasury = Address::generate(&e);
    let id = e.register(PredictionMarket, ());
    let client = PredictionMarketClient::new(&e, &id);
    client.initialize(&admin, &token_addr, &treasury, &fee_bps);

    Fixture { e, client, token, treasury }
}

fn fund(f: &Fixture, who: &Address, amt: i128) {
    let admin_client = token::StellarAssetClient::new(&f.e, &f.token.address);
    admin_client.mint(who, &amt);
}

#[test]
fn full_market_flow_prorata() {
    let f = setup(0);
    let mid = f.client.create_market(&String::from_str(&f.e, "Who wins Swimsuit?"), &String::from_str(&f.e, "swimsuit"), &2, &2_000);

    let alice = Address::generate(&f.e);
    let bob = Address::generate(&f.e);
    let carol = Address::generate(&f.e);
    for a in [&alice, &bob, &carol] { fund(&f, a, 1_000); }

    f.client.stake(&alice, &mid, &0, &100);
    f.client.stake(&bob, &mid, &1, &100);
    f.client.stake(&carol, &mid, &0, &100);

    let m = f.client.market(&mid);
    assert_eq!(m.total_pool, 300);
    assert_eq!(f.client.pool_of(&mid, &0), 200);
    assert_eq!(f.client.pool_of(&mid, &1), 100);

    f.client.resolve_market(&mid, &0);

    // alice: 100/200 of the 300 pool = 150
    let paid = f.client.claim(&alice, &mid);
    assert_eq!(paid, 150);
    assert_eq!(f.token.balance(&alice), 900 + 150);
    // carol: also 150
    assert_eq!(f.client.claim(&carol, &mid), 150);
    // bob backed the losing option → nothing
    assert!(f.client.try_claim(&bob, &mid).is_err());
    // no double claim
    assert!(f.client.try_claim(&alice, &mid).is_err());
}

#[test]
fn fee_goes_to_treasury() {
    let f = setup(200); // 2%
    let mid = f.client.create_market(&String::from_str(&f.e, "Winner?"), &String::from_str(&f.e, "overall"), &2, &2_000);
    let alice = Address::generate(&f.e);
    let bob = Address::generate(&f.e);
    fund(&f, &alice, 1_000);
    fund(&f, &bob, 1_000);
    f.client.stake(&alice, &mid, &0, &100);
    f.client.stake(&bob, &mid, &1, &100);
    f.client.resolve_market(&mid, &0);
    // gross = 100 * 200 / 100 = 200; profit = 100; fee = 2% of PROFIT = 2; net = 198.
    // (The stake itself is never charged a fee.)
    let net = f.client.claim(&alice, &mid);
    assert_eq!(net, 198);
    assert_eq!(f.token.balance(&f.treasury), 2);
}

#[test]
fn sole_winner_pays_no_fee() {
    // Only staker on the winning side of a one-sided market: gross == stake, profit == 0,
    // so the fee must be zero and they get exactly their stake back.
    let f = setup(200); // 2%
    let mid = f.client.create_market(&String::from_str(&f.e, "Solo?"), &String::from_str(&f.e, "general"), &2, &2_000);
    let alice = Address::generate(&f.e);
    fund(&f, &alice, 1_000);
    f.client.stake(&alice, &mid, &0, &100);
    f.client.resolve_market(&mid, &0);
    let net = f.client.claim(&alice, &mid);
    assert_eq!(net, 100);
    assert_eq!(f.token.balance(&alice), 1_000);
    assert_eq!(f.token.balance(&f.treasury), 0);
}

#[test]
fn no_stake_after_close() {
    let f = setup(0);
    let mid = f.client.create_market(&String::from_str(&f.e, "Q"), &String::from_str(&f.e, "talent"), &2, &2_000);
    let alice = Address::generate(&f.e);
    fund(&f, &alice, 1_000);
    f.e.ledger().set_timestamp(2_500); // past close_time
    assert!(f.client.try_stake(&alice, &mid, &0, &100).is_err());
}

#[test]
fn cancel_then_refund() {
    let f = setup(0);
    let mid = f.client.create_market(&String::from_str(&f.e, "Q"), &String::from_str(&f.e, "gown"), &3, &2_000);
    let alice = Address::generate(&f.e);
    fund(&f, &alice, 1_000);
    f.client.stake(&alice, &mid, &0, &100);
    f.client.stake(&alice, &mid, &2, &50);
    f.client.cancel_market(&mid);
    let refunded = f.client.refund(&alice, &mid);
    assert_eq!(refunded, 150);
    assert_eq!(f.token.balance(&alice), 1_000);
    assert!(f.client.try_refund(&alice, &mid).is_err()); // no double refund
}

#[test]
fn admin_force_refund_returns_funds_to_original_staker() {
    let f = setup(0);
    let mid = f.client.create_market(&String::from_str(&f.e, "Q"), &String::from_str(&f.e, "overall"), &2, &2_000);
    let alice = Address::generate(&f.e);
    fund(&f, &alice, 1_000);
    f.client.stake(&alice, &mid, &0, &125);
    f.client.cancel_market(&mid);

    assert_eq!(f.client.force_refund(&alice, &mid), 125);
    assert_eq!(f.token.balance(&alice), 1_000);
    assert!(f.client.try_force_refund(&alice, &mid).is_err());
    assert!(f.client.try_refund(&alice, &mid).is_err());
}

#[test]
fn large_market_supports_more_than_one_hundred_options_and_constant_cost_refund() {
    let f = setup(0);
    let mid = f.client.create_market(&String::from_str(&f.e, "Large delegate field"), &String::from_str(&f.e, "overall"), &150, &2_000);
    let alice = Address::generate(&f.e);
    fund(&f, &alice, 1_000);
    f.client.stake(&alice, &mid, &149, &175);
    f.client.cancel_market(&mid);

    assert_eq!(f.client.force_refund(&alice, &mid), 175);
    assert_eq!(f.token.balance(&alice), 1_000);
}

#[test]
fn unstake_cancels_position_and_refunds() {
    let f = setup(0);
    let mid = f.client.create_market(&String::from_str(&f.e, "Q"), &String::from_str(&f.e, "swimsuit"), &3, &2_000);
    let alice = Address::generate(&f.e);
    let bob = Address::generate(&f.e);
    fund(&f, &alice, 1_000);
    fund(&f, &bob, 1_000);
    f.client.stake(&alice, &mid, &0, &100);
    f.client.stake(&bob, &mid, &0, &100);
    assert_eq!(f.client.pool_of(&mid, &0), 200);

    // alice cancels her position → refunded, pools/total reduced.
    let refunded = f.client.unstake(&alice, &mid, &0);
    assert_eq!(refunded, 100);
    assert_eq!(f.token.balance(&alice), 1_000);
    assert_eq!(f.client.pool_of(&mid, &0), 100);
    assert_eq!(f.client.market(&mid).total_pool, 100);
    // nothing left to unstake
    assert!(f.client.try_unstake(&alice, &mid, &0).is_err());

    // after close, unstaking is rejected
    f.e.ledger().set_timestamp(2_500);
    assert!(f.client.try_unstake(&bob, &mid, &0).is_err());
}

#[test]
fn pause_blocks_staking() {
    let f = setup(0);
    let mid = f.client.create_market(&String::from_str(&f.e, "Q"), &String::from_str(&f.e, "costume"), &2, &2_000);
    let alice = Address::generate(&f.e);
    fund(&f, &alice, 1_000);
    f.client.pause();
    assert!(f.client.try_stake(&alice, &mid, &0, &100).is_err());
    f.client.unpause();
    f.client.stake(&alice, &mid, &0, &100);
    assert_eq!(f.client.pool_of(&mid, &0), 100);
}

#[test]
fn resolve_with_no_winner_stake_rejected() {
    let f = setup(0);
    let mid = f.client.create_market(&String::from_str(&f.e, "Q"), &String::from_str(&f.e, "overall"), &2, &2_000);
    let alice = Address::generate(&f.e);
    fund(&f, &alice, 1_000);
    f.client.stake(&alice, &mid, &0, &100);
    // option 1 has no stake → can't resolve to it (funds would lock)
    assert!(f.client.try_resolve_market(&mid, &1).is_err());
}
