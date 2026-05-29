import {
  useEffect,
  useMemo,
  useState,
  type HTMLInputTypeAttribute,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseAppError } from "@/modules/items/utils";
import { DataImportSection } from "@/modules/settings/DataImportSection";
import { BackupSection } from "@/modules/settings/BackupSection";
import UsersManagement from "@/modules/settings/users";
import { useAuthStore } from "@/store/authSlice";
import { invoke } from "@/shared/utils/invoke";

import {
  type ReceiptSize,
  type SettingsValues,
  useSettings,
} from "./useSettings";

type TabId = "shop" | "printing" | "invoices" | "users" | "backup" | "advanced";

const tabLabels: Record<TabId, string> = {
  shop: "معلومات المحل",
  printing: "الطباعة",
  invoices: "الفواتير",
  users: "المستخدمون",
  backup: "النسخ الاحتياطي",
  advanced: "متقدم",
};

const fileSizeFormatter = new Intl.NumberFormat("ar-EG", {
  maximumFractionDigits: 1,
});

export default function SettingsPage() {
  const canAccessUsers = useAuthStore((state) => state.canAccess("users"));
  const queryClient = useQueryClient();
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

  const printersQuery = useQuery({
    queryKey: ["settings-printers"],
    queryFn: () =>
      invoke<string[]>("list_printers", undefined, { toast: false }),
  });

  useEffect(() => {
    if (printersQuery.error) {
      toast.error(parseAppError(printersQuery.error).message_ar);
    }
  }, [printersQuery.error]);

  const dbSizeQuery = useQuery({
    queryKey: ["settings-db-size"],
    queryFn: () =>
      invoke<number>("get_db_file_size", undefined, { toast: false }),
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (dbSizeQuery.error) {
      toast.error(parseAppError(dbSizeQuery.error).message_ar);
    }
  }, [dbSizeQuery.error]);

  const vacuumMutation = useMutation({
    mutationFn: () =>
      invoke<boolean>("vacuum_database", undefined, { toast: false }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings-db-size"] });
      toast.success("تم تحسين قاعدة البيانات بنجاح");
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

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
      await invoke("print_test_receipt", {
        printerName: settings.defaultPrinter.trim() || undefined,
      });
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
        <div className="absolute inset-y-0 end-0 w-48 bg-gradient-to-l from-primary/10 to-transparent" />
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

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-row items-center justify-between gap-3 border-b px-6 py-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: HTMLInputTypeAttribute;
  className?: string;
}) {
  return (
    <label className={cn("space-y-2 text-right", className)}>
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <Input
        dir="rtl"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3 text-right">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-input accent-primary"
      />
    </label>
  );
}

function ReceiptSizeOption({
  label,
  value,
  checked,
  onChange,
}: {
  label: string;
  value: ReceiptSize;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition-colors",
        checked
          ? "border-primary bg-primary/5"
          : "bg-background hover:bg-muted/40",
      )}
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type="radio"
        name="receipt-size"
        value={value}
        checked={checked}
        onChange={onChange}
      />
    </label>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-dashed bg-muted/20">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-full bg-background p-2 text-muted-foreground">
          {icon}
        </div>
        <div className="space-y-1 text-right">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            {label}
          </p>
          <p className="text-sm font-medium text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${fileSizeFormatter.format(value)} ${units[unitIndex]}`;
}
