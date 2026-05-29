export function ensureCashPaidAtLeastTotal(
  paidCashMillieme: number,
  totalMillieme: number,
): number {
  return Math.max(paidCashMillieme, totalMillieme);
}

export function shouldSyncCashPaidToTotal(params: {
  paymentMethod: "cash" | "card" | "deferred" | "split";
  paidCashMillieme: number;
  totalMillieme: number;
}): boolean {
  return (
    params.paymentMethod === "cash" &&
    params.paidCashMillieme < params.totalMillieme
  );
}
