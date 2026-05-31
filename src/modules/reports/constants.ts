import type { GroupBy } from "@/modules/reports/types";

export const chartColors = ["#2563eb", "#16a34a", "#dc2626", "#f59e0b", "#7c3aed"];

export const paymentMethodLabels: Record<string, string> = {
  cash: "كاش",
  card: "فيزا",
  deferred: "آجل",
  split: "مختلط",
};

export const groupLabels: Record<GroupBy, string> = {
  day: "يومي",
  week: "أسبوعي",
  month: "شهري",
};
