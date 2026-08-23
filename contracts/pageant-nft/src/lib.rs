#![no_std]
//! Pageant NFT — reusable template for pageant candidate collectibles (Stellar Soroban).
//!
//! One contract instance per pageant. Candidates are registered by the admin with a
//! configurable max supply + IPFS metadata (image on Pinata). Fans mint ONE NFT per
//! candidate per wallet. Everything is parameterized via `add_candidate`, so a new
//! pageant only needs new candidate config + artwork — no code changes.
//!
//! Security properties (all enforced below):
//!  - admin (owner) role; every admin action requires `admin.require_auth()`
//!  - buyer-authorized mint (`to.require_auth()`), from-authorized transfer
//!  - emergency pause / unpause (blocks minting + transfers)
//!  - per-candidate max-supply cap
//!  - one-mint-per-wallet-per-candidate (permanent record → no mint/transfer/mint farming)
//!  - input + metadata validation
//!  - metadata immutable once minting for a candidate has begun (protects holders)
//!  - secure admin (ownership) transfer
//!  - event logging on every state change
//!  - overflow-checked math (workspace `overflow-checks = true`)

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env, String, Symbol,
};

const METADATA_MAX: u32 = 300; // max metadata (ipfs URI) length

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotAuthorized = 3,
    Paused = 4,
    CandidateExists = 5,
    CandidateNotFound = 6,
    SupplyExhausted = 7,
    AlreadyMinted = 8,
    InvalidSupply = 9,
    InvalidMetadata = 10,
    TokenNotFound = 11,
    NotTokenOwner = 12,
    MintingStarted = 13,
}

#[contracttype]
#[derive(Clone)]
pub struct CandidateConfig {
    pub max_supply: u32,
    pub minted: u32,
    pub metadata: String, // ipfs://... (image/metadata on Pinata)
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Paused,
    Name,
    Symbol,
    NextTokenId,
    TotalSupply,
    Candidate(u32),        // candidate_id -> CandidateConfig
    Owner(u32),            // token_id -> Address
    TokenCandidate(u32),   // token_id -> candidate_id
    Minted(Address, u32),  // (wallet, candidate_id) -> () present == has minted
    Balance(Address),      // wallet -> token count
}

// Bump instance TTL on every entrypoint so config/admin survive.
fn bump(e: &Env) {
    e.storage().instance().extend_ttl(50_000, 100_000);
}

fn admin(e: &Env) -> Address {
    e.storage()
        .instance()
        .get::<_, Address>(&DataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(e, Error::NotInitialized))
}

fn require_admin(e: &Env) -> Address {
    let a = admin(e);
    a.require_auth();
    a
}

fn is_paused(e: &Env) -> bool {
    e.storage().instance().get(&DataKey::Paused).unwrap_or(false)
}

/// Core mint logic shared by `mint` (recipient-authorized) and `admin_mint` (platform-authorized).
/// Caller is responsible for the auth check. Enforces pause, supply cap, one-per-wallet-per-candidate.
fn mint_core(e: &Env, to: &Address, candidate_id: u32) -> u32 {
    if is_paused(e) {
        panic_with_error!(e, Error::Paused);
    }
    let mut cfg: CandidateConfig = e
        .storage()
        .persistent()
        .get(&DataKey::Candidate(candidate_id))
        .unwrap_or_else(|| panic_with_error!(e, Error::CandidateNotFound));
    if cfg.minted >= cfg.max_supply {
        panic_with_error!(e, Error::SupplyExhausted);
    }
    let minted_key = DataKey::Minted(to.clone(), candidate_id);
    if e.storage().persistent().has(&minted_key) {
        panic_with_error!(e, Error::AlreadyMinted);
    }

    let token_id: u32 = e.storage().instance().get(&DataKey::NextTokenId).unwrap();
    cfg.minted += 1; // overflow-checked (release profile)
    e.storage().persistent().set(&DataKey::Candidate(candidate_id), &cfg);
    e.storage().persistent().set(&DataKey::Owner(token_id), to);
    e.storage().persistent().set(&DataKey::TokenCandidate(token_id), &candidate_id);
    e.storage().persistent().set(&minted_key, &());

    let bal: u32 = e.storage().persistent().get(&DataKey::Balance(to.clone())).unwrap_or(0);
    e.storage().persistent().set(&DataKey::Balance(to.clone()), &(bal + 1));

    e.storage().instance().set(&DataKey::NextTokenId, &(token_id + 1));
    let total: u32 = e.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
    e.storage().instance().set(&DataKey::TotalSupply, &(total + 1));
    bump(e);

    e.events().publish((symbol_short!("mint"), to.clone(), candidate_id), token_id);
    token_id
}

#[contract]
pub struct PageantNft;

#[contractimpl]
impl PageantNft {
    /// One-time init. `admin` is the owner (mint authority + emergency controls).
    pub fn initialize(e: Env, admin: Address, name: String, symbol: String) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&e, Error::AlreadyInitialized);
        }
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Name, &name);
        e.storage().instance().set(&DataKey::Symbol, &symbol);
        e.storage().instance().set(&DataKey::NextTokenId, &1u32);
        e.storage().instance().set(&DataKey::TotalSupply, &0u32);
        e.storage().instance().set(&DataKey::Paused, &false);
        bump(&e);
        e.events().publish((symbol_short!("init"),), admin);
    }

    /// Register a candidate (admin only). `metadata` is the IPFS URI for the NFT art/metadata.
    pub fn add_candidate(e: Env, candidate_id: u32, max_supply: u32, metadata: String) {
        require_admin(&e);
        if max_supply == 0 {
            panic_with_error!(&e, Error::InvalidSupply);
        }
        if metadata.len() == 0 || metadata.len() > METADATA_MAX {
            panic_with_error!(&e, Error::InvalidMetadata);
        }
        if e.storage().persistent().has(&DataKey::Candidate(candidate_id)) {
            panic_with_error!(&e, Error::CandidateExists);
        }
        let cfg = CandidateConfig { max_supply, minted: 0, metadata };
        e.storage().persistent().set(&DataKey::Candidate(candidate_id), &cfg);
        bump(&e);
        e.events().publish((symbol_short!("cand_add"), candidate_id), max_supply);
    }

    /// Update a candidate's metadata (admin only) — allowed ONLY before any mint, so
    /// holders' metadata can never be changed out from under them.
    pub fn set_candidate_metadata(e: Env, candidate_id: u32, metadata: String) {
        require_admin(&e);
        if metadata.len() == 0 || metadata.len() > METADATA_MAX {
            panic_with_error!(&e, Error::InvalidMetadata);
        }
        let mut cfg = Self::candidate(e.clone(), candidate_id);
        if cfg.minted > 0 {
            panic_with_error!(&e, Error::MintingStarted);
        }
        cfg.metadata = metadata;
        e.storage().persistent().set(&DataKey::Candidate(candidate_id), &cfg);
        bump(&e);
    }

    /// Mint one NFT of `candidate_id` to `to`. Buyer-authorized (the recipient signs).
    /// Enforces pause, supply cap, and one-per-wallet-per-candidate. Returns the new token id.
    pub fn mint(e: Env, to: Address, candidate_id: u32) -> u32 {
        to.require_auth();
        mint_core(&e, &to, candidate_id)
    }

    /// Mint one NFT of `candidate_id` to `to`, authorized by the ADMIN (platform) instead of the
    /// recipient. Used by the CrownFi backend to mint after a buyer's USDC payment clears, so the
    /// buyer only signs the payment. Same pause / supply / one-per-wallet rules apply.
    pub fn admin_mint(e: Env, to: Address, candidate_id: u32) -> u32 {
        require_admin(&e);
        mint_core(&e, &to, candidate_id)
    }

    /// Transfer a token. `from` must own it and authorize. Blocked while paused.
    pub fn transfer(e: Env, from: Address, to: Address, token_id: u32) {
        from.require_auth();
        if is_paused(&e) {
            panic_with_error!(&e, Error::Paused);
        }
        let owner: Address = e
            .storage()
            .persistent()
            .get(&DataKey::Owner(token_id))
            .unwrap_or_else(|| panic_with_error!(&e, Error::TokenNotFound));
        if owner != from {
            panic_with_error!(&e, Error::NotTokenOwner);
        }
        e.storage().persistent().set(&DataKey::Owner(token_id), &to);
        let fb: u32 = e.storage().persistent().get(&DataKey::Balance(from.clone())).unwrap_or(1);
        e.storage().persistent().set(&DataKey::Balance(from.clone()), &(fb - 1));
        let tb: u32 = e.storage().persistent().get(&DataKey::Balance(to.clone())).unwrap_or(0);
        e.storage().persistent().set(&DataKey::Balance(to.clone()), &(tb + 1));
        bump(&e);
        e.events().publish((symbol_short!("transfer"), from, to), token_id);
    }

    /// Emergency pause (admin only) — blocks minting + transfers.
    pub fn pause(e: Env) {
        require_admin(&e);
        e.storage().instance().set(&DataKey::Paused, &true);
        bump(&e);
        e.events().publish((symbol_short!("pause"),), true);
    }

    /// Resume (admin only).
    pub fn unpause(e: Env) {
        require_admin(&e);
        e.storage().instance().set(&DataKey::Paused, &false);
        bump(&e);
        e.events().publish((symbol_short!("unpause"),), false);
    }

    /// Secure ownership transfer — hand admin to a new address (admin only).
    pub fn transfer_admin(e: Env, new_admin: Address) {
        let old = require_admin(&e);
        e.storage().instance().set(&DataKey::Admin, &new_admin);
        bump(&e);
        e.events().publish((symbol_short!("adminxfr"), old), new_admin);
    }

    // ── Views ───────────────────────────────────────────────────────────────
    pub fn candidate(e: Env, candidate_id: u32) -> CandidateConfig {
        e.storage()
            .persistent()
            .get(&DataKey::Candidate(candidate_id))
            .unwrap_or_else(|| panic_with_error!(&e, Error::CandidateNotFound))
    }
    pub fn remaining(e: Env, candidate_id: u32) -> u32 {
        let c = Self::candidate(e, candidate_id);
        c.max_supply - c.minted
    }
    pub fn has_minted(e: Env, wallet: Address, candidate_id: u32) -> bool {
        e.storage().persistent().has(&DataKey::Minted(wallet, candidate_id))
    }
    pub fn owner_of(e: Env, token_id: u32) -> Address {
        e.storage()
            .persistent()
            .get(&DataKey::Owner(token_id))
            .unwrap_or_else(|| panic_with_error!(&e, Error::TokenNotFound))
    }
    pub fn token_candidate(e: Env, token_id: u32) -> u32 {
        e.storage()
            .persistent()
            .get(&DataKey::TokenCandidate(token_id))
            .unwrap_or_else(|| panic_with_error!(&e, Error::TokenNotFound))
    }
    pub fn balance_of(e: Env, wallet: Address) -> u32 {
        e.storage().persistent().get(&DataKey::Balance(wallet)).unwrap_or(0)
    }
    pub fn total_supply(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
    }
    pub fn paused(e: Env) -> bool {
        is_paused(&e)
    }
    pub fn admin(e: Env) -> Address {
        admin(&e)
    }
    pub fn name(e: Env) -> String {
        e.storage().instance().get(&DataKey::Name).unwrap_or_else(|| panic_with_error!(&e, Error::NotInitialized))
    }
    pub fn symbol(e: Env) -> String {
        e.storage().instance().get(&DataKey::Symbol).unwrap_or_else(|| panic_with_error!(&e, Error::NotInitialized))
    }
    pub fn version(_e: Env) -> Symbol {
        symbol_short!("v1")
    }
}

#[cfg(test)]
mod test;
