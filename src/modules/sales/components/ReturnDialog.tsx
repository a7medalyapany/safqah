import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
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
import { useCreateReturnMutation } from "@/modules/sales/hooks";
import type {
  InvoiceDetail,
  InvoiceItemDetail,
  RefundMethod,
} from "@/modules/sales/types";
import {
  getReturnableQty,
  getReturnLineRefundMillieme,
} from "@/modules/sales/utils";
import { parseAppError } from "@/modules/items/utils";
import { FilterField } from "@/shared/components/FilterField";
import { TableCell, TableHeadCell } from "@/shared/components/DataTable";
import { SummaryRow } from "@/shared/components/SummaryRow";
import { formatEGP } from "@/shared/utils/money";

export function ReturnDialog({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceDetail;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("cash");

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextSelected: Record<number, boolean> = {};
    const nextQuantities: Record<number, number> = {};
    for (const item of invoice.items) {
      const returnableQty = getReturnableQty(item);
      nextSelected[item.id] = false;
      nextQuantities[item.id] = returnableQty > 0 ? 1 : 0;
    }

    setStep(1);
    setSelected(nextSelected);
    setQuantities(nextQuantities);
    setRefundMethod(invoice.customer_id ? "credit" : "cash");
  }, [invoice, open]);

  const returnableItems = invoice.items.filter(
    (item) => getReturnableQty(item) > 0,
  );
  const selectedItems = returnableItems.filter((item) => selected[item.id]);
  const selectedTotal = selectedItems.reduce(
    (total, item) =>
      total +
      getReturnLineRefundMillieme(
        item,
        quantities[item.id] ?? 0,
        invoice.subtotal_millieme,
        invoice.total_millieme,
      ),
    0,
  );

  const createReturnMutation = useCreateReturnMutation(invoice.id);

  const updateQuantity = (item: InvoiceItemDetail, value: string) => {
    const maxQty = getReturnableQty(item);
    const numericValue = Number.parseInt(value, 10);
    const nextQty = Number.isNaN(numericValue) ? 1 : numericValue;
    setQuantities((current) => ({
      ...current,
      [item.id]: Math.min(Math.max(nextQty, 1), maxQty),
    }));
  };

  const handleConfirm = () => {
    if (selectedItems.length === 0) {
      toast.error("اختر صنفًا واحدًا على الأقل للمرتجع");
      return;
    }

    createReturnMutation.mutate(
      {
        originalInvoiceId: invoice.id,
        sessionId: invoice.session_id,
        items: selectedItems.map((item) => ({
          invoiceItemId: item.id,
          itemId: item.item_id,
          qty: quantities[item.id] ?? 1,
        })),
        refundMethod,
        notes: null,
      },
      {
        onSuccess: () => {
          toast.success("تم تسجيل المرتجع بنجاح");
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(parseAppError(error).message_ar);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-h-[88vh] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>إنشاء مرتجع</DialogTitle>
          <DialogDescription>
            {step === 1
              ? "اختر الأصناف والكميات المطلوب إرجاعها."
              : "راجع ملخص المرتجع قبل التأكيد."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-3">
            {returnableItems.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                لا توجد كميات متاحة للمرتجع في هذه الفاتورة.
              </div>
            ) : (
              returnableItems.map((item) => {
                const maxQty = getReturnableQty(item);

                return (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_8rem]"
                  >
                    <label className="flex min-w-0 items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-primary"
                        checked={Boolean(selected[item.id])}
                        onChange={(event) =>
                          setSelected((current) => ({
                            ...current,
                            [item.id]: event.target.checked,
                          }))
                        }
                      />
                      <span className="min-w-0 space-y-1">
                        <span className="block truncate font-medium">
                          {item.item_name_ar}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          الكمية الأصلية: {item.qty} | متاح للمرتجع: {maxQty}
                        </span>
                      </span>
                    </label>

                    <FilterField label="كمية المرتجع">
                      <Input
                        type="number"
                        min={1}
                        max={maxQty}
                        value={quantities[item.id] ?? 1}
                        disabled={!selected[item.id]}
                        onChange={(event) =>
                          updateQuantity(item, event.target.value)
                        }
                      />
                    </FilterField>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-right text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <TableHeadCell>الصنف</TableHeadCell>
                    <TableHeadCell>الكمية</TableHeadCell>
                    <TableHeadCell>الإجمالي</TableHeadCell>
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map((item) => (
                    <tr key={item.id} className="border-t">
                      <TableCell className="font-medium text-foreground">
                        {item.item_name_ar}
                      </TableCell>
                      <TableCell>{quantities[item.id] ?? 1}</TableCell>
                      <TableCell>
                        {formatEGP(
                          getReturnLineRefundMillieme(
                            item,
                            quantities[item.id] ?? 1,
                            invoice.subtotal_millieme,
                            invoice.total_millieme,
                          ),
                        )}
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
              <SummaryRow
                label="إجمالي المرتجع"
                value={formatEGP(selectedTotal)}
                className="text-base font-semibold"
              />
              <FilterField label="طريقة رد المبلغ">
                <select
                  dir="rtl"
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={refundMethod}
                  onChange={(event) =>
                    setRefundMethod(event.target.value as RefundMethod)
                  }
                >
                  <option value="cash">نقدي</option>
                  <option value="credit" disabled={!invoice.customer_id}>
                    رصيد للعميل
                  </option>
                </select>
              </FilterField>
            </div>
          </div>
        )}

        <DialogFooter className="flex-row-reverse justify-start gap-2 bg-transparent p-0 pt-2">
          {step === 2 ? (
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              disabled={createReturnMutation.isPending}
            >
              رجوع
            </Button>
          ) : null}
          {step === 1 ? (
            <Button
              onClick={() => setStep(2)}
              disabled={
                selectedItems.length === 0 || createReturnMutation.isPending
              }
            >
              التالي
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              disabled={createReturnMutation.isPending}
            >
              <RotateCcw />
              تأكيد المرتجع
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
