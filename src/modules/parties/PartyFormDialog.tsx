import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import type {
  Party,
  PartyFormValues,
  PartyKind,
} from "@/modules/parties/types";
import {
  getPartyMeta,
  parseAppError,
  toPartyFormValues,
  toPartyPayload,
} from "@/modules/parties/utils";
import { invoke } from "@/shared/utils/invoke";

type PartyFormDialogProps = {
  kind: PartyKind;
  party?: Party | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PartyFormDialog({
  kind,
  party,
  open,
  onOpenChange,
}: PartyFormDialogProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<PartyFormValues>(
    toPartyFormValues(kind, party),
  );
  const isEdit = Boolean(party);
  const meta = getPartyMeta(kind);

  useEffect(() => {
    if (open) {
      setValues(toPartyFormValues(kind, party));
    }
  }, [kind, open, party]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = toPartyPayload(kind, values);

      if (isEdit && party) {
        return invoke<Party>(
          `update_${kind}`,
          {
            id: party.id,
            payload,
          },
          { toast: false },
        );
      }

      return invoke<Party>(`create_${kind}`, { payload }, { toast: false });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [kind] });
      toast.success(
        isEdit
          ? `تم تحديث بيانات ${meta.singular} بنجاح`
          : `تم إضافة ${meta.singular} بنجاح`,
      );
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

  const handleChange = (field: keyof PartyFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!values.name.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }

    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>
            {isEdit
              ? `تعديل بيانات ${meta.singular}`
              : `إضافة ${meta.singular}`}
          </DialogTitle>
          <DialogDescription>
            أدخل البيانات الأساسية ثم احفظ التغييرات.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="الاسم *"
              value={values.name}
              onChange={(value) => handleChange("name", value)}
              required
            />
            <Field
              label="الهاتف"
              value={values.phone}
              onChange={(value) => handleChange("phone", value)}
            />
            <Field
              label="الرصيد"
              type="number"
              step="0.001"
              inputMode="decimal"
              value={values.balance}
              onChange={(value) => handleChange("balance", value)}
            />
            {kind === "customer" ? (
              <Field
                label="الحد الائتماني"
                type="number"
                step="0.001"
                inputMode="decimal"
                value={values.credit_limit}
                onChange={(value) => handleChange("credit_limit", value)}
              />
            ) : (
              <Field
                label="الرقم الضريبي"
                value={values.tax_number}
                onChange={(value) => handleChange("tax_number", value)}
              />
            )}
            <Field
              label="العنوان"
              value={values.address}
              onChange={(value) => handleChange("address", value)}
              className="md:col-span-2"
            />
            <TextAreaField
              label="ملاحظات"
              value={values.notes}
              onChange={(value) => handleChange("notes", value)}
              className="md:col-span-2"
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
              {isEdit ? "حفظ التعديلات" : `إضافة ${meta.singular}`}
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
  required?: boolean;
  type?: React.HTMLInputTypeAttribute;
  step?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  className?: string;
};

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  step,
  inputMode,
  className,
}: FieldProps) {
  return (
    <label className={`space-y-2 text-right ${className ?? ""}`}>
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <Input
        dir="rtl"
        type={type}
        step={step}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`space-y-2 text-right ${className ?? ""}`}>
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <textarea
        dir="rtl"
        className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
