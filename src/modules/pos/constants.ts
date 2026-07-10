// Keep the POS catalog fresh: short stale window so reopening the page or
// refocusing the app pulls the latest prices/stock without an app reload.
export const POS_STALE_TIME_MS = 10 * 1000;

export const posKeys = {
  categories: ["categories"] as const,
  items: (query: string, categoryId: number | null) =>
    ["pos-items", query, categoryId] as const,
  customers: (query: string) => ["customers", query] as const,
};
