import { toast } from "sonner";

import { printReport } from "@/shared/utils/printReport";

// Re-exported from the shared date utilities (single source of truth, local-date based).
export { today, monthStart } from "@/shared/utils/date";

export function egpValue(millieme: number) {
  return Math.round((millieme / 1000) * 100) / 100;
}

export function printTable(title: string, table: HTMLTableElement | null) {
  if (!table) {
    toast.error("لا يوجد جدول متاح للطباعة");
    return;
  }

  printReport(title, table.outerHTML);
}

export function missingValue(value: string | null | undefined) {
  return value || "—";
}
