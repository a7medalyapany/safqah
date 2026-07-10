import type { Dispatch, SetStateAction } from "react";
import { PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "@/modules/items/types";

import { Field, FilterField } from "./PurchasePrimitives";

/** The draft fields for creating a brand-new item from within the purchase form. */
export type NewItemDraft = {
  name: string;
  barcode: string;
  categoryId: string;
  qty: string;
  buyPrice: string;
  sellPrice: string;
};

export function NewItemForm({
  values,
  onChange,
  categories,
  onSubmit,
  isSubmitting,
}: {
  values: NewItemDraft;
  onChange: Dispatch<SetStateAction<NewItemDraft>>;
  categories: Category[];
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <Field
        label="اسم الصنف"
        value={values.name}
        onChange={(value) => onChange((current) => ({ ...current, name: value }))}
      />
      <Field
        label="الباركود"
        value={values.barcode}
        onChange={(value) =>
          onChange((current) => ({ ...current, barcode: value }))
        }
      />
      <FilterField label="التصنيف">
        <Select
          value={values.categoryId || "none"}
          onValueChange={(next) =>
            onChange((current) => ({
              ...current,
              categoryId: next === "none" ? "" : next,
            }))
          }
        >
          <SelectTrigger dir="rtl" className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="none">بدون تصنيف</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name_ar}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
      <Field
        label="الكمية"
        type="number"
        min="1"
        value={values.qty}
        onChange={(value) => onChange((current) => ({ ...current, qty: value }))}
      />
      <Field
        label="سعر الشراء"
        type="number"
        step="0.001"
        min="0"
        value={values.buyPrice}
        onChange={(value) =>
          onChange((current) => ({ ...current, buyPrice: value }))
        }
      />
      <Field
        label="سعر البيع"
        type="number"
        step="0.001"
        min="0"
        value={values.sellPrice}
        onChange={(value) =>
          onChange((current) => ({ ...current, sellPrice: value }))
        }
      />
      <div className="md:col-span-2">
        <Button type="button" onClick={onSubmit} disabled={isSubmitting}>
          <PlusCircle />
          إضافة الصنف للفاتورة
        </Button>
      </div>
    </div>
  );
}
