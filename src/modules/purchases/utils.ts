import type { DraftPurchaseItem, PriceSuggestion, PurchaseStatus } from "@/modules/purchases/types";
import { toMillieme } from "@/shared/utils/money";

export function getStatusTone(status: PurchaseStatus) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (status === "deferred") {
    return "border-orange-200 bg-orange-100 text-orange-800";
  }

  return "border-yellow-200 bg-yellow-100 text-yellow-800";
}

export function formatDate(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDateOnly(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "short",
  }).format(date);
}

export function calculateProfitMargin(costMillieme: number, sellMillieme: number) {
  if (sellMillieme <= 0) {
    return null;
  }

  return ((sellMillieme - costMillieme) / sellMillieme) * 100;
}

export function formatMarginLabel(margin: number | null) {
  if (margin === null || Number.isNaN(margin)) {
    return "—";
  }

  return `${margin.toFixed(1)}%`;
}

export function safeToMillieme(value: string) {
  try {
    return toMillieme(value);
  } catch {
    return 0;
  }
}

export function toMoneyInput(milliemes: number) {
  const value = (milliemes / 1000).toFixed(3);
  return value.replace(/\.0+$/, "").replace(/\.$/, "");
}

export function parseInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildPriceSuggestions(items: DraftPurchaseItem[]): PriceSuggestion[] {
  return items
    .map((item) => {
      const suggestedSellPriceMillieme = item.suggestedSellPrice.trim()
        ? safeToMillieme(item.suggestedSellPrice)
        : null;

      if (
        suggestedSellPriceMillieme === null ||
        suggestedSellPriceMillieme === item.currentSellPriceMillieme
      ) {
        return null;
      }

      return {
        itemId: item.itemId,
        itemName: item.itemName,
        currentSellPriceMillieme: item.currentSellPriceMillieme,
        suggestedSellPriceMillieme,
      };
    })
    .filter((item): item is PriceSuggestion => Boolean(item));
}
