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
  paidCashManuallySet: boolean;
}): boolean {
  if (params.paymentMethod !== "cash") {
    return false;
  }

  // A hand-typed overpay (customer handed a bigger bill) must survive cart
  // edits; an auto-filled amount should track the total in both directions.
  if (params.paidCashManuallySet) {
    return params.paidCashMillieme < params.totalMillieme;
  }

  return params.paidCashMillieme !== params.totalMillieme;
}
