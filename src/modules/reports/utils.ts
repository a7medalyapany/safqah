import { toast } from "sonner";

import { printReport } from "@/shared/utils/printReport";

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function monthStart() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

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
