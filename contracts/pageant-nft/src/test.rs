#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Env, String};

fn setup(e: &Env) -> (PageantNftClient<'_>, Address) {
    e.mock_all_auths();
    let id = e.register(PageantNft, ());
    let client = PageantNftClient::new(e, &id);
    let admin = Address::generate(e);
    client.initialize(&admin, &String::from_str(e, "CrownFi Pageant"), &String::from_str(e, "CFP"));
    (client, admin)
}

#[test]
fn mint_happy_path() {
    let e = Env::default();
    let (client, _admin) = setup(&e);
    client.add_candidate(&1, &2, &String::from_str(&e, "ipfs://cid/1.json"));

    let alice = Address::generate(&e);
    let tid = client.mint(&alice, &1);
    assert_eq!(tid, 1);
    assert_eq!(client.owner_of(&1), alice);
    assert_eq!(client.token_candidate(&1), 1);
    assert!(client.has_minted(&alice, &1));
    assert_eq!(client.remaining(&1), 1);
    assert_eq!(client.total_supply(), 1);
    assert_eq!(client.balance_of(&alice), 1);
}

#[test]
fn admin_mint_platform_authorized() {
    let e = Env::default();
    let (client, _admin) = setup(&e);
    client.add_candidate(&1, &1000000, &String::from_str(&e, "ipfs://cid/1.json"));

    // Platform mints to the buyer (no buyer signature) after payment clears.
    let buyer = Address::generate(&e);
    let tid = client.admin_mint(&buyer, &1);
    assert_eq!(client.owner_of(&tid), buyer);
    assert!(client.has_minted(&buyer, &1));
    // One-per-wallet still holds for admin_mint.
    assert!(client.try_admin_mint(&buyer, &1).is_err());
}

#[test]
fn one_per_wallet_per_candidate() {
    let e = Env::default();
    let (client, _admin) = setup(&e);
    client.add_candidate(&1, &10, &String::from_str(&e, "ipfs://cid/1.json"));
    let alice = Address::generate(&e);
    client.mint(&alice, &1);
    // Second mint by the same wallet for the same candidate must fail.
    assert!(client.try_mint(&alice, &1).is_err());
}

#[test]
fn supply_cap_enforced() {
    let e = Env::default();
    let (client, _admin) = setup(&e);
    client.add_candidate(&1, &2, &String::from_str(&e, "ipfs://cid/1.json"));
    client.mint(&Address::generate(&e), &1);
    client.mint(&Address::generate(&e), &1);
    // Third mint exceeds max_supply of 2.
    assert!(client.try_mint(&Address::generate(&e), &1).is_err());
    assert_eq!(client.remaining(&1), 0);
}

#[test]
fn pause_blocks_minting() {
    let e = Env::default();
    let (client, _admin) = setup(&e);
    client.add_candidate(&1, &5, &String::from_str(&e, "ipfs://cid/1.json"));
    client.pause();
    assert!(client.paused());
    assert!(client.try_mint(&Address::generate(&e), &1).is_err());
    client.unpause();
    let tid = client.mint(&Address::generate(&e), &1);
    assert_eq!(tid, 1);
}

#[test]
fn invalid_inputs_rejected() {
    let e = Env::default();
    let (client, _admin) = setup(&e);
    // supply 0
    assert!(client.try_add_candidate(&1, &0, &String::from_str(&e, "ipfs://x")).is_err());
    // empty metadata
    assert!(client.try_add_candidate(&2, &5, &String::from_str(&e, "")).is_err());
    // mint for a missing candidate
    assert!(client.try_mint(&Address::generate(&e), &99).is_err());
}

#[test]
fn transfer_moves_ownership() {
    let e = Env::default();
    let (client, _admin) = setup(&e);
    client.add_candidate(&1, &5, &String::from_str(&e, "ipfs://cid/1.json"));
    let alice = Address::generate(&e);
    let bob = Address::generate(&e);
    let tid = client.mint(&alice, &1);
    client.transfer(&alice, &bob, &tid);
    assert_eq!(client.owner_of(&tid), bob);
    assert_eq!(client.balance_of(&alice), 0);
    assert_eq!(client.balance_of(&bob), 1);
    // alice already minted this candidate — cannot mint again even after transferring away.
    assert!(client.try_mint(&alice, &1).is_err());
}
