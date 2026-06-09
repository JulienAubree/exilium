/**
 * Calculate the seller commission on a market offer.
 * Commission is paid by the seller at offer creation, on the same resource being sold.
 * Rounded up (ceil) to avoid fractional exploits.
 */
export function calculateSellerCommission(quantity: number, commissionPercent: number): number {
  if (quantity <= 0 || commissionPercent <= 0) return 0;
  return Math.ceil((quantity * commissionPercent) / 100);
}
