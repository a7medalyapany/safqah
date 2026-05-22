import { useState, useTransition } from "react";
import { invoke } from "@tauri-apps/api/core";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Category = {
  id: number;
  name_ar: string;
  created_at: string;
};

type Item = {
  id: number;
  barcode: string | null;
  name_ar: string;
  name_en: string | null;
  category_id: number | null;
  buy_price_millieme: number;
  sell_price_millieme: number;
  color: string | null;
  size: string | null;
  unit: string;
  min_stock: number;
  current_stock: number;
  supplier_id: number | null;
  image_path: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export default function ItemsPage() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState("جاهز لتشغيل فحص أوامر الأصناف.");
  const [details, setDetails] = useState("");

  const serializeError = (error: unknown): string => {
    if (typeof error === "string") {
      return error;
    }

    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }

    if (error && typeof error === "object") {
      try {
        return JSON.stringify(error, null, 2);
      } catch {
        return `نوع الخطأ: ${Object.prototype.toString.call(error)}`;
      }
    }

    return String(error);
  };

  const runCrudCheck = () => {
    startTransition(() => {
      void (async () => {
        let currentStep = "بدء الفحص";

        try {
          setStatus("جارٍ تنفيذ الفحص...");
          setDetails("");

          const suffix = Date.now().toString();
          const categoryName = `فئة اختبار ${suffix}`;
          const barcode = `TEST-${suffix}`;

          currentStep = "إنشاء الفئة";
          const category = await invoke<Category>("create_category", {
            nameAr: categoryName,
          });
          console.log("create_category", category);

          currentStep = "قراءة الفئات";
          const categories = await invoke<Category[]>("list_categories");
          console.log("list_categories", categories);

          currentStep = "إنشاء الصنف";
          const createdItem = await invoke<Item>("create_item", {
            payload: {
              barcode,
              name_ar: `صنف اختبار ${suffix}`,
              category_id: category.id,
              buy_price_millieme: 10000,
              sell_price_millieme: 12000,
              unit: "قطعة",
              min_stock: 1,
              current_stock: 5,
            },
          });
          console.log("create_item", createdItem);

          currentStep = "قراءة الأصناف";
          const items = await invoke<Item[]>("list_items", {
            search: "صنف اختبار",
            categoryId: category.id,
          });
          console.log("list_items", items);

          currentStep = "قراءة الصنف بالباركود";
          const byBarcode = await invoke<Item>("get_item_by_barcode", { barcode });
          console.log("get_item_by_barcode", byBarcode);

          currentStep = "تحديث الصنف";
          const updatedItem = await invoke<Item>("update_item", {
            id: createdItem.id,
            payload: {
              name_ar: `صنف محدث ${suffix}`,
              sell_price_millieme: 15000,
              current_stock: 7,
            },
          });
          console.log("update_item", updatedItem);

          currentStep = "حذف الصنف حذفًا منطقيًا";
          const deleted = await invoke<boolean>("delete_item", {
            id: createdItem.id,
          });
          console.log("delete_item", deleted);

          currentStep = "التحقق بعد الحذف";
          const itemsAfterDelete = await invoke<Item[]>("list_items", {
            search: barcode,
          });
          console.log("list_items_after_delete", itemsAfterDelete);

          setStatus("اكتمل الفحص. راجع console لنتائج جميع الأوامر.");
          setDetails("");
        } catch (error) {
          const serialized = serializeError(error);
          console.error("items_crud_check_failed", {
            step: currentStep,
            error,
            serialized,
          });
          setStatus(`فشل الفحص عند خطوة: ${currentStep}`);
          setDetails(serialized);
        }
      })();
    });
  };

  return (
    <div className="p-6">
      <Card className="mx-auto mt-10 max-w-3xl">
        <CardHeader>
          <CardTitle className="text-right text-2xl">فحص أوامر الأصناف</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-right">
          <p className="text-sm text-muted-foreground">
            هذه صفحة مؤقتة لتجربة أوامر إنشاء الفئات والأصناف وقراءتها وتحديثها
            وحذفها حذفًا منطقيًا.
          </p>

          <div className="flex flex-row-reverse">
            <Button onClick={runCrudCheck} disabled={isPending}>
              {isPending ? "جارٍ التنفيذ..." : "تشغيل الفحص"}
            </Button>
          </div>

          <p className="text-sm">{status}</p>

          {details ? (
            <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-left text-xs whitespace-pre-wrap">
              {details}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
