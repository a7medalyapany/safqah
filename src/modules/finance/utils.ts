import type { DateFilter } from "@/modules/finance/types";

export function getDateRange(filter: DateFilter): {
  dateFrom: string | null;
  dateTo: string | null;
} {
  if (filter === "all") return { dateFrom: null, dateTo: null };

  const now = new Date();
  let start: Date;

  switch (filter) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week": {
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
      break;
    }
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  const year = start!.getFullYear();
  const month = String(start!.getMonth() + 1).padStart(2, "0");
  const day = String(start!.getDate()).padStart(2, "0");

  return { dateFrom: `${year}-${month}-${day}`, dateTo: null };
}

export function relativeTime(days: number): string {
  if (days === 0) return "اليوم";
  if (days === 1) return "أمس";
  if (days < 7) return `${days} أيام`;
  if (days < 30) return `${Math.floor(days / 7)} أسبوع`;
  if (days < 365) return `${Math.floor(days / 30)} شهر`;
  return `${Math.floor(days / 365)} سنة`;
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
