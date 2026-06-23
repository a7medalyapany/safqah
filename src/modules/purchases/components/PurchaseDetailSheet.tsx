import { Pencil, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { paymentMethodLabels } from "@/modules/purchases/constants";
import type { PaymentMethod, PurchaseDetail } from "@/modules/purchases/types";
import { formatDate } from "@/modules/purchases/utils";
import { formatEGP } from "@/shared/utils/money";
import { printHtml } from "@/shared/utils/printHtml";
import { StatusBadge, SummaryRow, TableCell, TableHead } from "./PurchasePrimitives";

export function PurchaseDetailSheet({
  open,
  onOpenChange,
  purchase,
  isLoading,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: PurchaseDetail | null;
  isLoading: boolean;
  onEdit?: (purchase: PurchaseDetail) => void;
}) {
  const handlePrint = () => {
    if (!purchase) {
      return;
    }

    const itemsHtml = purchase.items
      .map(
        (item) =>
          `<tr><td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right">${item.item_name_ar}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">${item.qty}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:left">${formatEGP(item.unit_cost_millieme)}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:left">${formatEGP(item.total_millieme)}</td></tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>فاتورة مشتريات ${purchase.invoice_number}</title><style>body{font-family:'Segoe UI',Tahoma,Arial;padding:20px;margin:0;direction:rtl}.header{text-align:center;margin-bottom:16px;border-bottom:2px solid #333;padding-bottom:12px}.header h1{margin:0;font-size:20px}.header p{margin:2px 0;font-size:13px;color:#555}table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}th{background:#f5f5f5;padding:6px 8px;border-bottom:2px solid #ddd;text-align:right}.totals{margin-top:12px;font-size:13px;width:300px;margin-right:auto}.totals div{display:flex;justify-content:space-between;padding:3px 0}.totals .grand{font-weight:bold;font-size:15px;border-top:2px solid #333;padding-top:6px;margin-top:4px}.footer{text-align:center;margin-top:24px;font-size:12px;color:#888;border-top:1px solid #ddd;padding-top:12px}</style></head><body><div class="header"><h1>فاتورة مشتريات</h1><p>رقم الفاتورة: ${purchase.invoice_number}</p><p>التاريخ: ${formatDate(purchase.created_at)}</p>${purchase.supplier_name ? `<p>المورد: ${purchase.supplier_name}</p>` : ""}</div><table><thead><tr><th style="text-align:right">الصنف</th><th style="text-align:center">الكمية</th><th style="text-align:left">سعر الشراء</th><th style="text-align:left">الإجمالي</th></tr></thead><tbody>${itemsHtml}</tbody></table><div class="totals"><div><span>المجموع الفرعي</span><span>${formatEGP(purchase.subtotal_millieme)}</span></div>${purchase.discount_millieme ? `<div><span>الخصم</span><span>${formatEGP(purchase.discount_millieme)}</span></div>` : ""}<div class="grand"><span>الإجمالي</span><span>${formatEGP(purchase.total_millieme)}</span></div><div><span>المدفوع</span><span>${formatEGP(purchase.paid_millieme)}</span></div></div>${purchase.notes ? `<div style="margin-top:12px;font-size:12px;color:#555"><strong>ملاحظات:</strong> ${purchase.notes}</div>` : ""}<div class="footer">شكراً لزيارتكم</div></body></html>`;
    printHtml(html);
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

            <div className="flex flex-row-reverse gap-2">
              {onEdit ? (
                <Button onClick={() => onEdit(purchase)}>
                  <Pencil />
                  تعديل الفاتورة
                </Button>
              ) : null}
              <Button variant="outline" onClick={handlePrint}>
                <Printer />
                طباعة
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
