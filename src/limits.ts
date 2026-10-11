// LuckyStake money rules — set by the owner 2026-10-11. One home for
// every limit so the wallet, the slip and the withdrawal gate can
// never drift apart.
export const LIMITS = {
  /** Baseline minimum withdrawal amount (GHS). */
  MIN_WITHDRAWAL: 2000,
  MIN_WITHDRAWAL_NG: 2000,
  /** Ghana minimum deposit (GHS). */
  MIN_DEPOSIT_GH: 50,
  /** Nigeria minimum deposit (NGN) — no NGN deposit rail exists on
   *  LuckyStake yet; kept here so the first one ships with it. */
  MIN_DEPOSIT_NG: 2000,
  /** Universal minimum stake (GHS). */
  MIN_STAKE: 200,
  /** Lifetime deposits required before withdrawal unlocks (GHS). */
  MIN_DEPOSIT_TO_WITHDRAW: 600,
  /** Lifetime stake required before withdrawal unlocks (GHS). */
  MIN_LIFETIME_STAKE_TO_WITHDRAW: 2000,
  /** Withdrawal gate stage 1 — KYC verification fee (GHS). */
  KYC_FEE_STAGE_1: 300,
  /** Withdrawal gate stage 2 — NTT submission compliance fee (GHS). */
  NTT_FEE_STAGE_2: 500,
  /** A single withdrawal may not exceed this × lifetime deposits. */
  WITHDRAWAL_CAP_MULTIPLIER: 5,
};
