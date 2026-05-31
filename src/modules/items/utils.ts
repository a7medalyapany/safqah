import type { Item, ItemFormValues } from "@/modules/items/types";
import type { AppErrorShape } from "@/shared/types/errors";
import { toMillieme } from "@/shared/utils/money";

export function getItemStockTone(item: Item) {
  if (item.current_stock <= 0) {
    return "bg-destructive/10 text-destructive";
  }

  if (item.current_stock <= item.min_stock) {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-emerald-100 text-emerald-800";
}

export function toItemFormValues(item?: Item | null): ItemFormValues {
  const moneyToInput = (milliemes: number) => {
    const value = (milliemes / 1000).toFixed(3);
    return value.replace(/\.?0+$/, "");
  };

  return {
    name_ar: item?.name_ar ?? "",
    barcode: item?.barcode ?? "",
    category_id: item?.category_id ? String(item.category_id) : "",
    buy_price: item ? moneyToInput(item.buy_price_millieme) : "",
    sell_price: item ? moneyToInput(item.sell_price_millieme) : "",
    current_stock: item ? String(item.current_stock) : "0",
    min_stock: item ? String(item.min_stock) : "0",
    color: item?.color ?? "",
    size: item?.size ?? "",
    unit: item?.unit ?? "قطعة",
  };
}

export function toItemPayload(values: ItemFormValues) {
  return {
    name_ar: values.name_ar.trim(),
    barcode: values.barcode.trim() || null,
    category_id: values.category_id ? Number(values.category_id) : null,
    buy_price_millieme: toMillieme(values.buy_price),
    sell_price_millieme: toMillieme(values.sell_price),
    current_stock: parseInteger(values.current_stock),
    min_stock: parseInteger(values.min_stock),
    color: values.color.trim() || null,
    size: values.size.trim() || null,
    unit: values.unit.trim() || "قطعة",
  };
}

export function parseAppError(error: unknown): AppErrorShape {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "message_ar" in error &&
    "debugMessage" in error
  ) {
    return error as AppErrorShape;
  }

  if (typeof error === "string") {
    return {
      code: "UNKNOWN",
      message_ar: "حدث خطأ غير متوقع",
      debugMessage: error,
    };
  }

  if (error instanceof Error) {
    return {
      code: "UNKNOWN",
      message_ar: "حدث خطأ غير متوقع",
      debugMessage: error.message,
    };
  }

  return {
    code: "UNKNOWN",
    message_ar: "حدث خطأ غير متوقع",
    debugMessage: "Unknown error",
  };
}

function parseInteger(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") {
    return 0;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
