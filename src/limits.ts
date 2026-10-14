// LuckyStake money rules — set by the owner 2026-10-11. One home for
// every limit so the wallet, the slip and the withdrawal gate can
// never drift apart.
export const LIMITS = {
  /** Baseline minimum withdrawal amount (GHS). */
  MIN_WITHDRAWAL: 2000,
  MIN_WITHDRAWAL_NG: 2000,
  /** Ghana minimum deposit (GHS). Briefly 1 on 2026-10-12 for a live
   *  test; owner restored 50 the next morning. Set to 1 again
   *  2026-10-14 for the LuckyPay live test; owner reversed it back
   *  to 50 the same day. */
  MIN_DEPOSIT_GH: 50,
  /** Nigeria minimum deposit (NGN) — no NGN deposit rail exists on
   *  LuckyStake yet; kept here so the first one ships with it. */
  MIN_DEPOSIT_NG: 2000,
  /** Universal minimum stake (GHS). */
  MIN_STAKE: 200,
  /** Withdrawal gate step 1 — lifetime deposits required (GHS). */
  MIN_DEPOSIT_TO_WITHDRAW: 600,
  /** Withdrawal gate step 2 — KYC verification fee (GHS), paid this
   *  many times in separate payments, one after the other. */
  KYC_FEE: 300,
  KYC_PAYMENTS_REQUIRED: 2,
  /** Withdrawal gate step 3 — user verification & wallet activation
   *  fee (GHS), likewise paid this many times in separate payments. */
  USER_VERIFICATION_FEE: 200,
  VERIFICATION_PAYMENTS_REQUIRED: 2,
  /** A single withdrawal may not exceed this × lifetime deposits. */
  WITHDRAWAL_CAP_MULTIPLIER: 5,
};
