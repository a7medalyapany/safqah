import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { paymentMethodLabels } from "@/modules/purchases/constants";
import type { PaymentMethod, PurchaseDetail } from "@/modules/purchases/types";
import { formatDate } from "@/modules/purchases/utils";
import { formatEGP } from "@/shared/utils/money";
import { StatusBadge, SummaryRow, TableCell, TableHead } from "./PurchasePrimitives";

export function PurchaseDetailSheet({
  open,
  onOpenChange,
  purchase,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: PurchaseDetail | null;
  isLoading: boolean;
}) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent dir="rtl">
        <SheetHeader>
          <SheetTitle>
            {purchase?.invoice_number ?? "تفاصيل الفاتورة"}
          </SheetTitle>
          <SheetDescription>
            {purchase
              ? formatDate(purchase.created_at)
              : "جارٍ تحميل بيانات الفاتورة..."}
          </SheetDescription>
        </SheetHeader>

        {isLoading || !purchase ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">المورد</p>
                <p className="text-base font-medium">
                  {purchase.supplier_name || "بدون مورد"}
                </p>
              </div>
              <StatusBadge status={purchase.status} />
            </div>

            <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm">
              <SummaryRow
                label="طريقة الدفع"
                value={
                  paymentMethodLabels[
                    purchase.payment_method as PaymentMethod
                  ] ?? purchase.payment_method
                }
              />
              <SummaryRow label="الملاحظات" value={purchase.notes || "—"} />
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-right text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <TableHead>الصنف</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>سعر الشراء</TableHead>
                    <TableHead>سعر البيع المقترح</TableHead>
                    <TableHead>الإجمالي</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <TableCell className="font-medium text-foreground">
                        {item.item_name_ar}
                      </TableCell>
                      <TableCell>{item.qty}</TableCell>
                      <TableCell>
                        {formatEGP(item.unit_cost_millieme)}
                      </TableCell>
                      <TableCell>
                        {item.suggested_sell_price_millieme
                          ? formatEGP(item.suggested_sell_price_millieme)
                          : "—"}
                      </TableCell>
                      <TableCell>{formatEGP(item.total_millieme)}</TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
              <SummaryRow
                label="المجموع الفرعي"
                value={formatEGP(purchase.subtotal_millieme)}
              />
              <SummaryRow
                label="الخصم"
                value={formatEGP(purchase.discount_millieme)}
              />
              <Separator />
              <SummaryRow
                label="الإجمالي"
                value={formatEGP(purchase.total_millieme)}
                strong
              />
              <SummaryRow
                label="المدفوع"
                value={formatEGP(purchase.paid_millieme)}
              />
              <SummaryRow
                label="المتبقي"
                value={formatEGP(
                  Math.max(purchase.total_millieme - purchase.paid_millieme, 0),
                )}
              />
            </div>

            <Button variant="outline" onClick={handlePrint}>
              <Printer />
              طباعة
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
