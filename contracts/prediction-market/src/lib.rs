#![no_std]
//! Pageant Prediction Market (Stellar Soroban).
//!
//! Polymarket-style, but pageant-only. The admin creates markets (e.g. "Who wins the
//! Swimsuit Competition?") with N options. Users stake USDC on an option; stakes are
//! escrowed in this contract. After the event the admin resolves the winning option, and
//! winners claim a **pro-rata** share of the whole pool (minus an optional platform fee).
//!
//! Security:
//!  - admin role; `admin.require_auth()` on create/close/resolve/cancel/config
//!  - staker-authorized stakes + claims (`from.require_auth()`)
//!  - funds escrowed via the USDC token contract (SAC) — never trusts client balances
//!  - staking blocked after `close_time` and while paused (anti-manipulation)
//!  - resolution is admin-only and one-way; a market can't be re-resolved
//!  - double-claim prevention (`Claimed` flag)
//!  - cancel → full refunds path (e.g. void market)
//!  - overflow-checked i128 math; typed errors; events for full history

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, token,
    Address, Env, String,
};

// Market status
const OPEN: u32 = 0;
const CLOSED: u32 = 1;
const RESOLVED: u32 = 2;
const CANCELLED: u32 = 3;

const BPS_DENOM: i128 = 10_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotAuthorized = 3,
    Paused = 4,
    MarketNotFound = 5,
    InvalidOption = 6,
    InvalidAmount = 7,
    MarketClosed = 8,       // past close time / not open
    NotResolvable = 9,      // wrong status for resolve
    AlreadyClaimed = 10,
    NothingToClaim = 11,
    NotCancelled = 12,
    InvalidParams = 13,
    NoWinningStake = 14,
    NothingToUnstake = 15,
}

#[contracttype]
#[derive(Clone)]
pub struct MarketInfo {
    pub question: String,
    pub category: String,
    pub num_options: u32,
    pub close_time: u64,
    pub status: u32,
    pub winning_option: u32,
    pub total_pool: i128,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Token,
    Treasury,
    FeeBps,
    Paused,
    MarketCount,
    Market(u32),
    Pool(u32, u32),            // (market, option) -> i128
    Position(u32, Address, u32), // (market, user, option) -> i128
    Claimed(u32, Address),     // -> bool
}

fn bump(e: &Env) {
    e.storage().instance().extend_ttl(50_000, 100_000);
}
fn admin(e: &Env) -> Address {
    e.storage().instance().get::<_, Address>(&DataKey::Admin).unwrap_or_else(|| panic_with_error!(e, Error::NotInitialized))
}
fn require_admin(e: &Env) -> Address {
    let a = admin(e);
    a.require_auth();
    a
}
fn is_paused(e: &Env) -> bool {
    e.storage().instance().get(&DataKey::Paused).unwrap_or(false)
}
fn token_client(e: &Env) -> token::Client<'_> {
    let addr: Address = e.storage().instance().get(&DataKey::Token).unwrap_or_else(|| panic_with_error!(e, Error::NotInitialized));
    token::Client::new(e, &addr)
}
fn get_market(e: &Env, id: u32) -> MarketInfo {
    e.storage().persistent().get(&DataKey::Market(id)).unwrap_or_else(|| panic_with_error!(e, Error::MarketNotFound))
}
fn pool(e: &Env, id: u32, opt: u32) -> i128 {
    e.storage().persistent().get(&DataKey::Pool(id, opt)).unwrap_or(0)
}

#[contract]
pub struct PredictionMarket;

#[contractimpl]
impl PredictionMarket {
    /// One-time init. `token` is the USDC (SAC) contract, `treasury` receives fees.
    /// `fee_bps` is the platform cut of each payout (<= 1000 = 10%).
    pub fn initialize(e: Env, admin: Address, token: Address, treasury: Address, fee_bps: u32) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&e, Error::AlreadyInitialized);
        }
        if fee_bps > 1000 {
            panic_with_error!(&e, Error::InvalidParams);
        }
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Token, &token);
        e.storage().instance().set(&DataKey::Treasury, &treasury);
        e.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        e.storage().instance().set(&DataKey::Paused, &false);
        e.storage().instance().set(&DataKey::MarketCount, &0u32);
        bump(&e);
        e.events().publish((symbol_short!("init"),), admin);
    }

    /// Create a market (admin only). Returns the market id.
    pub fn create_market(e: Env, question: String, category: String, num_options: u32, close_time: u64) -> u32 {
        require_admin(&e);
        if num_options < 2 || num_options > 32 {
            panic_with_error!(&e, Error::InvalidParams);
        }
        if close_time <= e.ledger().timestamp() {
            panic_with_error!(&e, Error::InvalidParams);
        }
        let id: u32 = e.storage().instance().get(&DataKey::MarketCount).unwrap_or(0) + 1;
        let m = MarketInfo { question, category, num_options, close_time, status: OPEN, winning_option: 0, total_pool: 0 };
        e.storage().persistent().set(&DataKey::Market(id), &m);
        e.storage().instance().set(&DataKey::MarketCount, &id);
        bump(&e);
        e.events().publish((symbol_short!("create"), id), num_options);
        id
    }

    /// Stake `amount` USDC on `option` of `market_id`. Escrows the USDC in this contract.
    pub fn stake(e: Env, from: Address, market_id: u32, option: u32, amount: i128) {
        from.require_auth();
        if is_paused(&e) {
            panic_with_error!(&e, Error::Paused);
        }
        if amount <= 0 {
            panic_with_error!(&e, Error::InvalidAmount);
        }
        let mut m = get_market(&e, market_id);
        if m.status != OPEN || e.ledger().timestamp() >= m.close_time {
            panic_with_error!(&e, Error::MarketClosed);
        }
        if option >= m.num_options {
            panic_with_error!(&e, Error::InvalidOption);
        }

        // Pull the USDC into escrow (token contract enforces the real balance).
        token_client(&e).transfer(&from, &e.current_contract_address(), &amount);

        let cur = pool(&e, market_id, option);
        e.storage().persistent().set(&DataKey::Pool(market_id, option), &(cur + amount));
        let pos: i128 = e.storage().persistent().get(&DataKey::Position(market_id, from.clone(), option)).unwrap_or(0);
        e.storage().persistent().set(&DataKey::Position(market_id, from.clone(), option), &(pos + amount));
        m.total_pool += amount;
        e.storage().persistent().set(&DataKey::Market(market_id), &m);
        bump(&e);
        e.events().publish((symbol_short!("stake"), market_id, from), (option, amount));
    }

    /// Cancel a position: withdraw the caller's full stake on `option` while the market is still
    /// OPEN (before close time). Refunds the escrowed USDC to `from`. Returns the amount refunded.
    pub fn unstake(e: Env, from: Address, market_id: u32, option: u32) -> i128 {
        from.require_auth();
        if is_paused(&e) {
            panic_with_error!(&e, Error::Paused);
        }
        let mut m = get_market(&e, market_id);
        if m.status != OPEN || e.ledger().timestamp() >= m.close_time {
            panic_with_error!(&e, Error::MarketClosed);
        }
        if option >= m.num_options {
            panic_with_error!(&e, Error::InvalidOption);
        }
        let pos: i128 = e.storage().persistent().get(&DataKey::Position(market_id, from.clone(), option)).unwrap_or(0);
        if pos <= 0 {
            panic_with_error!(&e, Error::NothingToUnstake);
        }

        // Reverse the pool + position, then refund the escrowed USDC.
        let cur = pool(&e, market_id, option);
        e.storage().persistent().set(&DataKey::Pool(market_id, option), &(cur - pos));
        e.storage().persistent().set(&DataKey::Position(market_id, from.clone(), option), &0i128);
        m.total_pool -= pos;
        e.storage().persistent().set(&DataKey::Market(market_id), &m);
        token_client(&e).transfer(&e.current_contract_address(), &from, &pos);
        bump(&e);
        e.events().publish((symbol_short!("unstake"), market_id, from), (option, pos));
        pos
    }

    /// Close a market to new stakes (admin only). Optional — resolve also implies closed.
    pub fn close_market(e: Env, market_id: u32) {
        require_admin(&e);
        let mut m = get_market(&e, market_id);
        if m.status != OPEN {
            panic_with_error!(&e, Error::NotResolvable);
        }
        m.status = CLOSED;
        e.storage().persistent().set(&DataKey::Market(market_id), &m);
        bump(&e);
        e.events().publish((symbol_short!("close"), market_id), true);
    }

    /// Resolve a market to its winning option (admin only). One-way.
    pub fn resolve_market(e: Env, market_id: u32, winning_option: u32) {
        require_admin(&e);
        let mut m = get_market(&e, market_id);
        if m.status != OPEN && m.status != CLOSED {
            panic_with_error!(&e, Error::NotResolvable);
        }
        if winning_option >= m.num_options {
            panic_with_error!(&e, Error::InvalidOption);
        }
        if pool(&e, market_id, winning_option) <= 0 {
            // No one backed the winner — cancel + refund instead of locking funds.
            panic_with_error!(&e, Error::NoWinningStake);
        }
        m.status = RESOLVED;
        m.winning_option = winning_option;
        e.storage().persistent().set(&DataKey::Market(market_id), &m);
        bump(&e);
        e.events().publish((symbol_short!("resolve"), market_id), winning_option);
    }

    /// Cancel a market (admin only) — enables full refunds via `refund`.
    pub fn cancel_market(e: Env, market_id: u32) {
        require_admin(&e);
        let mut m = get_market(&e, market_id);
        if m.status == RESOLVED {
            panic_with_error!(&e, Error::NotResolvable);
        }
        m.status = CANCELLED;
        e.storage().persistent().set(&DataKey::Market(market_id), &m);
        bump(&e);
        e.events().publish((symbol_short!("cancel"), market_id), true);
    }

    /// Claim winnings from a resolved market (pro-rata of the whole pool, minus fee).
    pub fn claim(e: Env, from: Address, market_id: u32) -> i128 {
        from.require_auth();
        let m = get_market(&e, market_id);
        if m.status != RESOLVED {
            panic_with_error!(&e, Error::NotResolvable);
        }
        if e.storage().persistent().get::<_, bool>(&DataKey::Claimed(market_id, from.clone())).unwrap_or(false) {
            panic_with_error!(&e, Error::AlreadyClaimed);
        }
        let stake: i128 = e.storage().persistent().get(&DataKey::Position(market_id, from.clone(), m.winning_option)).unwrap_or(0);
        if stake <= 0 {
            panic_with_error!(&e, Error::NothingToClaim);
        }
        let winning_pool = pool(&e, market_id, m.winning_option);
        // gross = stake * total_pool / winning_pool  (checked math)
        let gross: i128 = stake.checked_mul(m.total_pool).unwrap() / winning_pool;
        // The fee applies to WINNINGS only (gross minus the winner's own stake back) —
        // never to the stake itself. A sole winner therefore pays no fee at all.
        let fee_bps: u32 = e.storage().instance().get(&DataKey::FeeBps).unwrap_or(0);
        let profit: i128 = gross - stake;
        let fee: i128 = if profit > 0 { profit * (fee_bps as i128) / BPS_DENOM } else { 0 };
        let net = gross - fee;

        e.storage().persistent().set(&DataKey::Claimed(market_id, from.clone()), &true);
        let tok = token_client(&e);
        if fee > 0 {
            let treasury: Address = e.storage().instance().get(&DataKey::Treasury).unwrap();
            tok.transfer(&e.current_contract_address(), &treasury, &fee);
        }
        tok.transfer(&e.current_contract_address(), &from, &net);
        bump(&e);
        e.events().publish((symbol_short!("claim"), market_id, from), net);
        net
    }

    /// Refund all of `from`'s stakes on a CANCELLED market.
    pub fn refund(e: Env, from: Address, market_id: u32) -> i128 {
        from.require_auth();
        let m = get_market(&e, market_id);
        if m.status != CANCELLED {
            panic_with_error!(&e, Error::NotCancelled);
        }
        if e.storage().persistent().get::<_, bool>(&DataKey::Claimed(market_id, from.clone())).unwrap_or(false) {
            panic_with_error!(&e, Error::AlreadyClaimed);
        }
        let mut total: i128 = 0;
        for opt in 0..m.num_options {
            let pos: i128 = e.storage().persistent().get(&DataKey::Position(market_id, from.clone(), opt)).unwrap_or(0);
            total += pos;
        }
        if total <= 0 {
            panic_with_error!(&e, Error::NothingToClaim);
        }
        e.storage().persistent().set(&DataKey::Claimed(market_id, from.clone()), &true);
        token_client(&e).transfer(&e.current_contract_address(), &from, &total);
        bump(&e);
        e.events().publish((symbol_short!("refund"), market_id, from), total);
        total
    }

    // ── Admin config ────────────────────────────────────────────────────────
    pub fn pause(e: Env) {
        require_admin(&e);
        e.storage().instance().set(&DataKey::Paused, &true);
        bump(&e);
    }
    pub fn unpause(e: Env) {
        require_admin(&e);
        e.storage().instance().set(&DataKey::Paused, &false);
        bump(&e);
    }
    pub fn set_fee(e: Env, fee_bps: u32) {
        require_admin(&e);
        if fee_bps > 1000 {
            panic_with_error!(&e, Error::InvalidParams);
        }
        e.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        bump(&e);
    }
    pub fn transfer_admin(e: Env, new_admin: Address) {
        require_admin(&e);
        e.storage().instance().set(&DataKey::Admin, &new_admin);
        bump(&e);
    }

    // ── Views ───────────────────────────────────────────────────────────────
    pub fn market(e: Env, market_id: u32) -> MarketInfo {
        get_market(&e, market_id)
    }
    pub fn pool_of(e: Env, market_id: u32, option: u32) -> i128 {
        pool(&e, market_id, option)
    }
    pub fn position_of(e: Env, market_id: u32, user: Address, option: u32) -> i128 {
        e.storage().persistent().get(&DataKey::Position(market_id, user, option)).unwrap_or(0)
    }
    pub fn has_claimed(e: Env, market_id: u32, user: Address) -> bool {
        e.storage().persistent().get(&DataKey::Claimed(market_id, user)).unwrap_or(false)
    }
    pub fn market_count(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::MarketCount).unwrap_or(0)
    }
    pub fn paused(e: Env) -> bool {
        is_paused(&e)
    }
    pub fn admin(e: Env) -> Address {
        admin(&e)
    }
}

#[cfg(test)]
mod test;
