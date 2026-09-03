// ─────────────────────────────────────────────────────────────────────────────
// CrownFi — user-facing messages (single source of truth)
//
// The API returns STABLE machine codes (e.g. "duplicate_vote"). The UI never shows
// those codes directly — it translates them to friendly copy through this file.
// Keeping every user-facing string here means:
//   • consistent wording across pages (no more per-page inline mappings),
//   • one place to edit tone/copy,
//   • a clean seam for i18n later (swap this map per locale).
//
// Rule: servers speak CODES, this file speaks HUMAN.
// ─────────────────────────────────────────────────────────────────────────────

export const ERROR_MESSAGES: Record<string, string> = {
  // ── Wallet / session / registration ──
  invalid_address: "That doesn’t look like a valid Stellar wallet address.",
  missing_signature: "We couldn’t read your wallet signature. Please try connecting again.",
  bad_signature: "That signature didn’t match your wallet. Please try again.",
  invalid_challenge: "Your sign-in request expired. Please connect again.",
  challenge_expired: "Your sign-in request expired. Please connect again.",
  fan_auth_required: "Please connect your wallet to continue.",
  admin_auth_required: "Please verify your admin wallet to continue.",
  address_mismatch: "The signed-in wallet doesn’t match this action. Reconnect and try again.",
  ip_registration_limit: "This network has reached the maximum number of new accounts. If this is a shared connection, please try from your own device or contact support.",
  wallet_linked_elsewhere: "This wallet is already linked to another CrownFi account. Sign in with it instead.",

  // ── Voting ──
  duplicate_vote: "You’ve already voted in this round.",
  quota_reached: "You’ve already voted in this round.",
  round_closed: "This round is closed — voting is no longer open.",
  round_not_found: "We couldn’t find that voting round.",
  no_vote_for_fan: "We couldn’t find a vote from your wallet in this round.",
  round_not_closed: "Results aren’t available until the round is closed.",

  // ── Tickets & seats ──
  seat_taken: "That seat was just taken — please pick another.",
  invalid_seat: "That seat selection was invalid — please try again.",
  missing_seat: "Please choose a seat first.",
  not_ticket_owner_or_admin: "You can only change seats on your own ticket.",
  ticket_not_found: "We couldn’t find that ticket.",
  ticket_already_redeemed: "This ticket has already been redeemed.",
  use_prepare_confirm_flow: "Please complete the secure checkout to buy this.",

  // ── Collectibles / minting ──
  already_owned: "You already own this collectible.",
  not_listed: "This collectible isn’t available to mint yet.",
  no_wallet: "Connect a wallet before minting.",
  buy_failed: "The purchase didn’t go through. Please try again.",
  prepare_failed: "We couldn’t start the transaction. Please try again.",
  confirm_failed: "We couldn’t confirm the transaction. Please try again.",
  invalid_or_expired_intent: "This checkout expired. Please start again.",

  // ── Faucet ──
  invalid_amount: "Enter an amount between 1 and 100 test USDC.",
  faucet_failed: "The faucet couldn’t send test USDC right now. Please try again.",

  // ── Loyalty ──
  already_completed: "You’ve already claimed this task.",
  task_not_found: "That task is no longer available.",
  missing_task: "Something went wrong selecting that task.",
  missing_reward: "Something went wrong selecting that reward.",
  reward_not_found: "That reward is no longer available.",
  insufficient_points: "You don’t have enough points for that yet.",
  out_of_stock: "That reward is sold out.",

  // ── Prediction markets ──
  market_limit_reached: "You’ve reached your limit of open community markets. Close or resolve one before creating another.",
  invalid_options: "Add at least two options (comma-separated) for people to predict on.",
  duplicate_options: "Each outcome must have a different name.",
  invalid_close_time: "Choose a closing date and time in the future.",
  market_closed: "This market is closed — predictions are no longer accepted.",
  onchain_create_failed: "We couldn’t open this market on-chain. Please try again.",
  onchain_failed: "The on-chain update didn’t go through. Please try again.",
  use_onchain_stake: "This market settles on-chain — please stake with your wallet.",
  not_onchain: "This market isn’t on-chain, so there’s nothing to claim.",
  not_resolved: "This market hasn’t been resolved yet.",
  nothing_to_claim: "You don’t have a winning payout to claim here.",
  nothing_to_refund: "You don’t have an unclaimed position to refund from this market.",
  nothing_to_unstake: "You don’t have an active position to cancel here.",
  market_has_positions: "This market has participant positions and must be kept for settlement and audit history.",
  market_has_positions_use_cancel: "This market has positions, so it cannot be deleted. Cancel it instead so every participant can claim a full refund.",
  market_cancelled_has_positions: "The live market was cancelled on-chain, but it was kept because participants have positions to settle.",
  market_not_editable: "Only an open market with no positions can be edited.",
  not_market_creator: "Only this market’s creator or a CrownFi admin can manage it.",
  market_changed: "This market changed while you were managing it. Refresh and try again.",
  market_replacement_failed: "The old market was safely cancelled, but its edited replacement could not be opened. Create a new market and try again.",
  market_update_failed: "We couldn’t save your market changes. Please try again.",
  market_delete_failed: "We couldn’t delete this market. Please try again.",
  file_too_large: "That image is too large (max 8MB).",
  invalid_file_type: "Please upload a PNG, JPG, WebP, or GIF image.",

  // ── KYC ──
  kyc_required: "This action requires identity verification. Please complete verification first.",
  kyc_pending: "Your identity verification is still under review.",

  // ── Generic / infra ──
  rate_limited: "You’re doing that too quickly — please wait a moment and try again.",
  payments_disabled: "Payments are currently turned off. Please check back soon.",
  gcash_not_configured: "GCash isn’t connected yet. Add your PayMongo merchant keys to enable it.",
  maintenance: "CrownFi is under maintenance right now. Paid actions are paused — please try again shortly.",
  missing_fields: "Some required details are missing. Please check the form and try again.",
  invalid_json: "We couldn’t read that request. Please try again.",
  not_found: "We couldn’t find what you were looking for.",
  db_unavailable: "The service is temporarily unavailable. Please try again shortly.",
  database_unavailable: "The service is temporarily unavailable. Please try again shortly.",
  server_error: "Something went wrong on our end. Please try again.",
};

export const DEFAULT_ERROR = "Something went wrong. Please try again.";

/**
 * Translate a machine error code (or a raw error string) into friendly copy.
 * Handles a couple of common substring cases (insufficient balance / trustline)
 * that the Stellar SDK surfaces as free-text rather than codes.
 */
export function messageFor(code?: string | null, fallback: string = DEFAULT_ERROR): string {
  if (!code) return fallback;
  if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  const lower = code.toLowerCase();
  if (lower.includes("balance") || lower.includes("trustline")) {
    return "Not enough test USDC — get some from the faucet first.";
  }
  if (lower.includes("cancel") || lower.includes("reject")) {
    return "You cancelled the request in your wallet.";
  }
  return fallback;
}
