import type { TabId } from "@/modules/settings/types";

export const tabLabels: Record<TabId, string> = {
  shop: "معلومات المحل",
  printing: "الطباعة",
  invoices: "الفواتير",
  users: "المستخدمون",
  backup: "النسخ الاحتياطي",
  advanced: "متقدم",
};

export const settingsKeys = {
  printers: ["settings-printers"] as const,
  dbSize: ["settings-db-size"] as const,
};
