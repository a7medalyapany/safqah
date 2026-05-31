export const POS_STALE_TIME_MS = 5 * 60 * 1000;

export const posKeys = {
  categories: ["categories"] as const,
  items: (query: string, categoryId: number | null) =>
    ["pos-items", query, categoryId] as const,
  customers: (query: string) => ["customers", query] as const,
};
