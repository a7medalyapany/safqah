import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { parseAppError } from "@/modules/items/utils";
import { invoke } from "@/shared/utils/invoke";

type RawSettings = Record<string, string>;

export type ReceiptSize = "full" | "mini";

export type SettingsValues = {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopLogoPath: string;
  currencySymbol: string;
  taxPercent: number;
  receiptSize: ReceiptSize;
  invoicePrefix: string;
  purchasePrefix: string;
  returnPrefix: string;
  defaultPrinter: string;
  lowStockAlert: boolean;
  backupIntervalHours: number;
  showShopNameOnReceipt: boolean;
  showShopAddressOnReceipt: boolean;
  showShopPhoneOnReceipt: boolean;
  showThankYouOnReceipt: boolean;
  receiptThankYouMessage: string;
};

export const defaultSettings: SettingsValues = {
  shopName: "اسم المحل",
  shopAddress: "العنوان",
  shopPhone: "",
  shopLogoPath: "",
  currencySymbol: "ج.م",
  taxPercent: 0,
  receiptSize: "full",
  invoicePrefix: "INV",
  purchasePrefix: "PUR",
  returnPrefix: "RET",
  defaultPrinter: "",
  lowStockAlert: true,
  backupIntervalHours: 4,
  showShopNameOnReceipt: true,
  showShopAddressOnReceipt: true,
  showShopPhoneOnReceipt: true,
  showThankYouOnReceipt: true,
  receiptThankYouMessage: "شكراً لزيارتكم",
};

export function normalizeSettings(
  raw: Partial<RawSettings> | null | undefined,
): SettingsValues {
  return {
    shopName: readText(raw?.shop_name, defaultSettings.shopName),
    shopAddress: readText(raw?.shop_address, defaultSettings.shopAddress),
    shopPhone: readText(raw?.shop_phone, defaultSettings.shopPhone),
    shopLogoPath: readText(raw?.shop_logo_path, defaultSettings.shopLogoPath),
    currencySymbol: readText(
      raw?.currency_symbol,
      defaultSettings.currencySymbol,
    ),
    taxPercent: readNumber(raw?.tax_percent, defaultSettings.taxPercent),
    receiptSize: raw?.receipt_size === "mini" ? "mini" : "full",
    invoicePrefix: readText(raw?.invoice_prefix, defaultSettings.invoicePrefix),
    purchasePrefix: readText(
      raw?.purchase_prefix,
      defaultSettings.purchasePrefix,
    ),
    returnPrefix: readText(raw?.return_prefix, defaultSettings.returnPrefix),
    defaultPrinter: readText(
      raw?.default_printer,
      defaultSettings.defaultPrinter,
    ),
    lowStockAlert: readBoolean(
      raw?.low_stock_alert,
      defaultSettings.lowStockAlert,
    ),
    backupIntervalHours: readNumber(
      raw?.backup_interval_hours,
      defaultSettings.backupIntervalHours,
    ),
    showShopNameOnReceipt: readBoolean(
      raw?.show_shop_name_on_receipt,
      defaultSettings.showShopNameOnReceipt,
    ),
    showShopAddressOnReceipt: readBoolean(
      raw?.show_shop_address_on_receipt,
      defaultSettings.showShopAddressOnReceipt,
    ),
    showShopPhoneOnReceipt: readBoolean(
      raw?.show_shop_phone_on_receipt,
      defaultSettings.showShopPhoneOnReceipt,
    ),
    showThankYouOnReceipt: readBoolean(
      raw?.show_thank_you_on_receipt,
      defaultSettings.showThankYouOnReceipt,
    ),
    receiptThankYouMessage: readText(
      raw?.receipt_thank_you_message,
      defaultSettings.receiptThankYouMessage,
    ),
  };
}

export function serializeSettings(settings: SettingsValues): RawSettings {
  return {
    shop_name: settings.shopName.trim(),
    shop_address: settings.shopAddress.trim(),
    shop_phone: settings.shopPhone.trim(),
    shop_logo_path: settings.shopLogoPath.trim(),
    currency_symbol: settings.currencySymbol.trim(),
    tax_percent: String(settings.taxPercent),
    receipt_size: settings.receiptSize,
    invoice_prefix: settings.invoicePrefix.trim(),
    purchase_prefix: settings.purchasePrefix.trim(),
    return_prefix: settings.returnPrefix.trim(),
    default_printer: settings.defaultPrinter.trim(),
    low_stock_alert: settings.lowStockAlert ? "1" : "0",
    backup_interval_hours: String(settings.backupIntervalHours),
    show_shop_name_on_receipt: settings.showShopNameOnReceipt ? "1" : "0",
    show_shop_address_on_receipt: settings.showShopAddressOnReceipt ? "1" : "0",
    show_shop_phone_on_receipt: settings.showShopPhoneOnReceipt ? "1" : "0",
    show_thank_you_on_receipt: settings.showThankYouOnReceipt ? "1" : "0",
    receipt_thank_you_message: settings.receiptThankYouMessage.trim(),
  };
}

export function useSettings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<SettingsValues>(defaultSettings);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: async () =>
      normalizeSettings(
        await invoke<RawSettings>("get_settings", undefined, { toast: false }),
      ),
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (settingsQuery.error) {
      toast.error(parseAppError(settingsQuery.error).message_ar);
    }
  }, [settingsQuery.error]);

  const saveSettings = useMutation({
    mutationFn: async (next: SettingsValues) => {
      await invoke<boolean>(
        "update_settings",
        {
          updates: serializeSettings(next),
        },
        { toast: false },
      );
      return next;
    },
    onSuccess: async (next) => {
      setSettings(next);
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("تم حفظ الإعدادات بنجاح");
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

  return {
    settings,
    setSettings,
    isLoading: settingsQuery.isLoading,
    isSaving: saveSettings.isPending,
    saveSettings: saveSettings.mutateAsync,
  };
}

function readText(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value === "1" || value === "true" || value === "yes";
}
