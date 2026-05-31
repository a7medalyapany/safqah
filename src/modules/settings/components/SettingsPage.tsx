import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  CircleGauge,
  Database,
  Loader2,
  Printer,
  ReceiptText,
  Save,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { parseAppError } from "@/modules/items/utils";
import { DataImportSection } from "@/modules/settings/DataImportSection";
import { BackupSection } from "@/modules/settings/BackupSection";
import { printTestReceipt } from "@/modules/settings/api";
import { tabLabels } from "@/modules/settings/constants";
import {
  Field,
  ReceiptSizeOption,
  Section,
  StatTile,
  ToggleField,
} from "@/modules/settings/components/SettingPrimitives";
import {
  useDbSizeQuery,
  usePrintersQuery,
  useVacuumDatabaseMutation,
} from "@/modules/settings/hooks";
import type { TabId } from "@/modules/settings/types";
import { formatBytes } from "@/modules/settings/utils";
import UsersManagement from "@/modules/settings/users";
import { useAuthStore } from "@/store/authSlice";

import { type SettingsValues, useSettings } from "../useSettings";

export default function SettingsPage() {
  const canAccessUsers = useAuthStore((state) => state.canAccess("users"));
  const [activeTab, setActiveTab] = useState<TabId>("shop");
  const { settings, setSettings, isLoading, isSaving, saveSettings } =
    useSettings();

  const availableTabs = useMemo<TabId[]>(() => {
    const tabs: TabId[] = ["shop", "printing", "invoices"];
    if (canAccessUsers) {
      tabs.push("users");
    }
    tabs.push("backup", "advanced");
    return tabs;
  }, [canAccessUsers]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [activeTab, availableTabs]);

  const printersQuery = usePrintersQuery();

  useEffect(() => {
    if (printersQuery.error) {
      toast.error(parseAppError(printersQuery.error).message_ar);
    }
  }, [printersQuery.error]);

  const dbSizeQuery = useDbSizeQuery();

  useEffect(() => {
    if (dbSizeQuery.error) {
      toast.error(parseAppError(dbSizeQuery.error).message_ar);
    }
  }, [dbSizeQuery.error]);

  const vacuumMutation = useVacuumDatabaseMutation();

  const saveCurrentSettings = async () => {
    if (!settings.shopName.trim()) {
      toast.error("اسم المحل مطلوب");
      return;
    }

    await saveSettings(settings);
  };

  const handleSettingChange = <K extends keyof SettingsValues>(
    key: K,
    value: SettingsValues[K],
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleLogoSelect = async () => {
    const selectedPath = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"],
        },
      ],
    });

    if (typeof selectedPath === "string") {
      handleSettingChange("shopLogoPath", selectedPath);
    }
  };

  const handlePrintTest = async () => {
    try {
      await printTestReceipt(settings.defaultPrinter.trim() || undefined);
      toast.success("تم إرسال طباعة تجريبية");
    } catch {
      // The invoke wrapper already showed the Arabic error.
    }
  };

  const selectedPrinter =
    settings.defaultPrinter || printersQuery.data?.[0] || "";

  useEffect(() => {
    if (!settings.defaultPrinter && selectedPrinter) {
      handleSettingChange("defaultPrinter", selectedPrinter);
    }
  }, [selectedPrinter]);

  return (
    <div className="space-y-6 p-6">
      <header className="relative overflow-hidden rounded-3xl border border-border/70 bg-card px-6 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          الإعدادات
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          إعدادات التطبيق
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          اضبط بيانات المحل والطباعة والفواتير والنسخ الاحتياطي من مكان واحد، مع
          حفظ مباشر في قاعدة البيانات.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-2">
        {availableTabs.map((tabId) => {
          const isActive = activeTab === tabId;

          return (
            <Button
              key={tabId}
              type="button"
              variant={isActive ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setActiveTab(tabId)}
            >
              {tabLabels[tabId]}
            </Button>
          );
        })}
      </div>

      {activeTab === "shop" ? (
        <Section
          title="معلومات المحل"
          action={
            <Button
              onClick={() => void saveCurrentSettings()}
              disabled={isLoading || isSaving}
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
              حفظ التغييرات
            </Button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="اسم المحل *"
              value={settings.shopName}
              onChange={(value) => handleSettingChange("shopName", value)}
            />
            <Field
              label="رقم الهاتف"
              value={settings.shopPhone}
              onChange={(value) => handleSettingChange("shopPhone", value)}
            />
            <Field
              label="العنوان"
              value={settings.shopAddress}
              onChange={(value) => handleSettingChange("shopAddress", value)}
              className="md:col-span-2"
            />

            <div className="space-y-2 md:col-span-2">
              <span className="block text-sm font-medium text-foreground">
                شعار المحل
              </span>
              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border/80 bg-muted/30 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleLogoSelect()}
                  >
                    <Upload />
                    اختيار صورة
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {settings.shopLogoPath || "لم يتم اختيار ملف"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Section>
      ) : null}

      {activeTab === "printing" ? (
        <Section
          title="الطباعة"
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handlePrintTest()}
                disabled={isLoading || isSaving || printersQuery.isLoading}
              >
                <Printer />
                طباعة تجريبية
              </Button>
              <Button
                onClick={() => void saveCurrentSettings()}
                disabled={isLoading || isSaving}
              >
                {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                حفظ
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-right md:col-span-2">
              <span className="block text-sm font-medium text-foreground">
                الطابعة الافتراضية
              </span>
              <select
                dir="rtl"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={settings.defaultPrinter}
                onChange={(event) =>
                  handleSettingChange("defaultPrinter", event.target.value)
                }
                disabled={printersQuery.isLoading}
              >
                <option value="">بدون</option>
                {printersQuery.data?.map((printer) => (
                  <option key={printer} value={printer}>
                    {printer}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-3 md:col-span-2">
              <span className="block text-sm font-medium text-foreground">
                حجم الفاتورة
              </span>
              <div className="grid gap-3 sm:grid-cols-2">
                <ReceiptSizeOption
                  label="كاملة (80mm)"
                  value="full"
                  checked={settings.receiptSize === "full"}
                  onChange={() => handleSettingChange("receiptSize", "full")}
                />
                <ReceiptSizeOption
                  label="مصغرة (58mm)"
                  value="mini"
                  checked={settings.receiptSize === "mini"}
                  onChange={() => handleSettingChange("receiptSize", "mini")}
                />
              </div>
            </div>

            <div className="space-y-3 md:col-span-2">
              <span className="block text-sm font-medium text-foreground">
                إظهار على الإيصال
              </span>
              <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-2">
                <ToggleField
                  label="إظهار اسم المحل"
                  checked={settings.showShopNameOnReceipt}
                  onChange={(checked) =>
                    handleSettingChange("showShopNameOnReceipt", checked)
                  }
                />
                <ToggleField
                  label="إظهار العنوان"
                  checked={settings.showShopAddressOnReceipt}
                  onChange={(checked) =>
                    handleSettingChange("showShopAddressOnReceipt", checked)
                  }
                />
                <ToggleField
                  label="إظهار رقم الهاتف"
                  checked={settings.showShopPhoneOnReceipt}
                  onChange={(checked) =>
                    handleSettingChange("showShopPhoneOnReceipt", checked)
                  }
                />
                <ToggleField
                  label="إظهار رسالة الشكر"
                  checked={settings.showThankYouOnReceipt}
                  onChange={(checked) =>
                    handleSettingChange("showThankYouOnReceipt", checked)
                  }
                />
              </div>
            </div>

            <Field
              label="رسالة الشكر"
              value={settings.receiptThankYouMessage}
              onChange={(value) =>
                handleSettingChange("receiptThankYouMessage", value)
              }
              className="md:col-span-2"
            />
          </div>
        </Section>
      ) : null}

      {activeTab === "invoices" ? (
        <Section
          title="الفواتير"
          action={
            <Button
              onClick={() => void saveCurrentSettings()}
              disabled={isLoading || isSaving}
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
              حفظ
            </Button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="بادئة فاتورة البيع"
              value={settings.invoicePrefix}
              onChange={(value) => handleSettingChange("invoicePrefix", value)}
            />
            <Field
              label="بادئة فاتورة الشراء"
              value={settings.purchasePrefix}
              onChange={(value) => handleSettingChange("purchasePrefix", value)}
            />
            <Field
              label="بادئة المرتجعات"
              value={settings.returnPrefix}
              onChange={(value) => handleSettingChange("returnPrefix", value)}
            />
            <Field
              label="نسبة الضريبة %"
              type="number"
              value={String(settings.taxPercent)}
              onChange={(value) =>
                handleSettingChange("taxPercent", Number(value || 0))
              }
            />
            <ToggleField
              label="تنبيه المخزون المنخفض"
              checked={settings.lowStockAlert}
              onChange={(checked) =>
                handleSettingChange("lowStockAlert", checked)
              }
            />
          </div>
        </Section>
      ) : null}

      {activeTab === "users" && canAccessUsers ? <UsersManagement /> : null}

      {activeTab === "backup" ? <BackupSection /> : null}

      {activeTab === "advanced" ? (
        <div className="space-y-6">
          <DataImportSection />
          <Section
            title="متقدم"
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => void vacuumMutation.mutateAsync()}
                  disabled={vacuumMutation.isPending}
                >
                  {vacuumMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Database />
                  )}
                  تشغيل VACUUM
                </Button>
                <Button variant="outline" type="button" disabled>
                  تصدير كل البيانات (CSV) - قريباً
                </Button>
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <StatTile
                icon={<CircleGauge className="size-4" />}
                label="حجم ملف قاعدة البيانات"
                value={
                  dbSizeQuery.isLoading
                    ? "جاري التحميل..."
                    : dbSizeQuery.data != null
                      ? formatBytes(dbSizeQuery.data)
                      : "غير متاح"
                }
              />
              <StatTile
                icon={<ReceiptText className="size-4" />}
                label="حالة الإعدادات"
                value={isLoading ? "جاري التحميل..." : "جاهزة"}
              />
            </div>
          </Section>
        </div>
      ) : null}
    </div>
  );
}
