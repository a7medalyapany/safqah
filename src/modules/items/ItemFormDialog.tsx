import {
  useEffect,
  useState,
  type FormEvent,
  type HTMLAttributes,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Category, Item, ItemFormValues } from "@/modules/items/types";
import {
  parseAppError,
  toItemFormValues,
  toItemPayload,
} from "@/modules/items/utils";
import { invoke } from "@/shared/utils/invoke";

type ItemFormDialogProps = {
  item?: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ItemFormDialog({
  item,
  open,
  onOpenChange,
}: ItemFormDialogProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<ItemFormValues>(toItemFormValues(item));
  const [barcodeError, setBarcodeError] = useState("");

  const isEdit = Boolean(item);

  useEffect(() => {
    if (open) {
      setValues(toItemFormValues(item));
      setBarcodeError("");
    }
  }, [item, open]);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      invoke<Category[]>("list_categories", undefined, { toast: false }),
    staleTime: 30 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = toItemPayload(values);

      if (isEdit && item) {
        return invoke<Item>(
          "update_item",
          {
            id: item.id,
            payload,
          },
          { toast: false },
        );
      }

      return invoke<Item>("create_item", { payload }, { toast: false });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["items-stats"] });
      toast.success(isEdit ? "تم تحديث الصنف بنجاح" : "تم إضافة الصنف بنجاح");
      onOpenChange(false);
    },
    onError: (error) => {
      const appError = parseAppError(error);

      if (appError.code === "DUPLICATE_BARCODE") {
        setBarcodeError(appError.message_ar);
        return;
      }

      toast.error(appError.message_ar);
    },
  });

  const handleChange = (field: keyof ItemFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));

    if (field === "barcode" && barcodeError) {
      setBarcodeError("");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBarcodeError("");

    if (!values.name_ar.trim()) {
      toast.error("اسم الصنف مطلوب");
      return;
    }

    if (!values.buy_price.trim() || !values.sell_price.trim()) {
      toast.error("يجب إدخال سعر الشراء وسعر البيع");
      return;
    }

    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>
            {isEdit ? "تعديل بيانات الصنف" : "إضافة صنف جديد"}
          </DialogTitle>
          <DialogDescription>
            أدخل بيانات الصنف ثم احفظ التغييرات.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="اسم الصنف *"
              value={values.name_ar}
              onChange={(value) => handleChange("name_ar", value)}
              required
            />
            <Field
              label="الباركود"
              value={values.barcode}
              onChange={(value) => handleChange("barcode", value)}
              error={barcodeError}
            />
            <SelectField
              label="التصنيف"
              value={values.category_id}
              onChange={(value) => handleChange("category_id", value)}
              options={categoriesQuery.data ?? []}
              loading={categoriesQuery.isLoading}
            />
            <Field
              label="الوحدة"
              value={values.unit}
              onChange={(value) => handleChange("unit", value)}
            />
            <Field
              label="سعر الشراء *"
              type="number"
              step="0.001"
              min="0"
              inputMode="decimal"
              value={values.buy_price}
              onChange={(value) => handleChange("buy_price", value)}
              required
            />
            <Field
              label="سعر البيع *"
              type="number"
              step="0.001"
              min="0"
              inputMode="decimal"
              value={values.sell_price}
              onChange={(value) => handleChange("sell_price", value)}
              required
            />
            <Field
              label="الكمية الحالية"
              type="number"
              step="1"
              inputMode="numeric"
              value={values.current_stock}
              onChange={(value) => handleChange("current_stock", value)}
            />
            <Field
              label="الحد الأدنى للمخزون"
              type="number"
              step="1"
              inputMode="numeric"
              value={values.min_stock}
              onChange={(value) => handleChange("min_stock", value)}
            />
            <Field
              label="اللون"
              value={values.color}
              onChange={(value) => handleChange("color", value)}
            />
            <Field
              label="المقاس"
              value={values.size}
              onChange={(value) => handleChange("size", value)}
            />
          </div>

          <DialogFooter className="flex-row-reverse justify-start gap-2 bg-transparent p-0 pt-2">
            <Button
              type="submit"
              className="min-w-28"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Save />
              )}
              {isEdit ? "حفظ التعديلات" : "إضافة الصنف"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: React.HTMLInputTypeAttribute;
  min?: string;
  step?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
};

function Field({
  label,
  value,
  onChange,
  error,
  required,
  type = "text",
  min,
  step,
  inputMode,
}: FieldProps) {
  return (
    <label className="space-y-2 text-right">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <Input
        dir="rtl"
        type={type}
        min={min}
        step={step}
        inputMode={inputMode}
        value={value}
        required={required}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Category[];
  loading: boolean;
};

function SelectField({
  label,
  value,
  onChange,
  options,
  loading,
}: SelectFieldProps) {
  return (
    <label className="space-y-2 text-right">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <select
        dir="rtl"
        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">بدون تصنيف</option>
        {loading ? <option value="">جارٍ تحميل التصنيفات...</option> : null}
        {options.map((category) => (
          <option key={category.id} value={String(category.id)}>
            {category.name_ar}
          </option>
        ))}
      </select>
    </label>
  );
}
