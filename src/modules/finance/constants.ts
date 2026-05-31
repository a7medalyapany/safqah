import type { DateFilter, PaymentMethod, TabId } from "@/modules/finance/types";

export const TABS: { id: TabId; label: string }[] = [
  { id: "receipts", label: "سندات القبض" },
  { id: "payments", label: "سندات الصرف" },
  { id: "deferred", label: "المديونيات" },
  { id: "expenses", label: "المصروفات" },
  { id: "summary", label: "ملخص الخزينة" },
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "كاش",
  card: "فيزا",
  bank: "تحويل بنكي",
};

export const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: "today", label: "اليوم" },
  { value: "week", label: "هذا الأسبوع" },
  { value: "month", label: "هذا الشهر" },
  { value: "all", label: "كل الوقت" },
];
