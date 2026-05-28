import { useState } from "react";
import type { ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Download, FileUp, Loader2, Package, Users, Truck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { exportToCsv } from "@/shared/utils/exportCsv";
import { parseAppError } from "@/modules/items/utils";

type CsvImportReport = {
  imported: number;
  skipped: number;
  errors: string[];
};

type ImportKey = "customers" | "items" | "suppliers";

type ImportTarget = {
  key: ImportKey;
  title: string;
  description: string;
  command: string;
  icon: ReactNode;
  templateFile: string;
  headers: string[];
};

const targets: ImportTarget[] = [
  {
    key: "customers",
    title: "استيراد العملاء",
    description:
      "الأعمدة: name, phone, address, balance_millieme, credit_limit_millieme, notes",
    command: "import_customers_csv",
    icon: <Users className="size-4" />,
    templateFile: "customers-template.csv",
    headers: [
      "name",
      "phone",
      "address",
      "balance_millieme",
      "credit_limit_millieme",
      "notes",
    ],
  },
  {
    key: "items",
    title: "استيراد المنتجات",
    description:
      "الأعمدة: barcode, name_ar, name_en, category_id/category_name, buy_price_millieme, sell_price_millieme, color, size, unit, min_stock, current_stock, supplier_id/supplier_name, image_path",
    command: "import_items_csv",
    icon: <Package className="size-4" />,
    templateFile: "items-template.csv",
    headers: [
      "barcode",
      "name_ar",
      "name_en",
      "category_id",
      "category_name",
      "buy_price_millieme",
      "sell_price_millieme",
      "color",
      "size",
      "unit",
      "min_stock",
      "current_stock",
      "supplier_id",
      "supplier_name",
      "image_path",
    ],
  },
  {
    key: "suppliers",
    title: "استيراد الموردين",
    description:
      "الأعمدة: name, phone, address, balance_millieme, tax_number, notes",
    command: "import_suppliers_csv",
    icon: <Truck className="size-4" />,
    templateFile: "suppliers-template.csv",
    headers: [
      "name",
      "phone",
      "address",
      "balance_millieme",
      "tax_number",
      "notes",
    ],
  },
];

export function DataImportSection() {
  const [busyKey, setBusyKey] = useState<ImportKey | null>(null);

  const importMutation = useMutation({
    mutationFn: async ({
      target,
      filePath,
    }: {
      target: ImportTarget;
      filePath: string;
    }) => {
      setBusyKey(target.key);
      return invoke<CsvImportReport>(target.command, { filePath });
    },
    onSuccess: (report, variables) => {
      const { target } = variables;
      toast.success(
        `تم استيراد ${report.imported} سجل${report.imported === 1 ? "" : "ات"} من ${target.title}`,
      );

      if (report.skipped > 0) {
        toast.warning(`تم تخطي ${report.skipped} صفًا بسبب أخطاء في البيانات`);
      }

      if (report.errors.length > 0) {
        console.log(`CSV import warnings for ${target.key}:`, report.errors);
      }
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
    onSettled: () => {
      setBusyKey(null);
    },
  });

  const handleImport = async (target: ImportTarget) => {
    try {
      toast.info(`اختر ملف CSV لـ ${target.title}`);

      const filePath = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });

      if (typeof filePath !== "string") {
        toast.info("لم يتم اختيار ملف");
        return;
      }

      await importMutation.mutateAsync({ target, filePath });
    } catch (error) {
      toast.error(parseAppError(error).message_ar);
    }
  };

  const handleTemplateDownload = (target: ImportTarget) => {
    exportToCsv(target.templateFile, target.headers, []);
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-row items-center justify-between gap-3 border-b px-6 py-5">
        <h2 className="text-lg font-semibold">استيراد البيانات من CSV</h2>
        <span className="text-sm text-muted-foreground">
          بدل الإدخال اليدوي
        </span>
      </div>
      <CardContent className="grid gap-4 p-6 md:grid-cols-3">
        {targets.map((target) => {
          const isBusy = busyKey === target.key && importMutation.isPending;

          return (
            <div
              key={target.key}
              className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-background p-2 text-muted-foreground">
                  {target.icon}
                </div>
                <div className="space-y-1 text-right">
                  <h3 className="font-semibold">{target.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {target.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="default"
                  onClick={() => void handleImport(target)}
                  disabled={importMutation.isPending}
                >
                  {isBusy ? <Loader2 className="animate-spin" /> : <FileUp />}
                  استيراد CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTemplateDownload(target)}
                >
                  <Download />
                  تنزيل قالب
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
