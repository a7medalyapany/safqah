import { useEffect, useState } from "react";
import { Printer, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  generateInvoicePdf,
  getInvoicePrintData,
  openWhatsappWithInvoice,
} from "@/modules/sales/api";
import { ReturnDialog } from "@/modules/sales/components/ReturnDialog";
import { StatusBadge } from "@/modules/sales/components/StatusBadge";
import type { InvoiceDetail } from "@/modules/sales/types";
import { getRemainingMillieme, getReturnableQty } from "@/modules/sales/utils";
import { parseAppError } from "@/modules/items/utils";
import { PdfPathDisplay } from "@/shared/components/PdfPathDisplay";
import { WhatsAppIcon } from "@/shared/components/WhatsAppIcon";
import { TableCell, TableHeadCell } from "@/shared/components/DataTable";
import { formatDate } from "@/shared/utils/date";
import { formatEGP } from "@/shared/utils/money";
import { printHtml } from "@/shared/utils/printHtml";

export function InvoiceDetailSheet({
  open,
  onOpenChange,
  invoice,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceDetail | null;
  isLoading: boolean;
}) {
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [whatsappPdfPath, setWhatsappPdfPath] = useState<string | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(false);

  useEffect(() => {
    setWhatsappPdfPath(null);
    setWhatsappLoading(false);
  }, [invoice?.id, open]);

  const handlePrint = async () => {
    if (!invoice) {
      return;
    }

    try {
      const data = await getInvoicePrintData(invoice.id);
      const itemsHtml = data.items
        .map(
          (item) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right">${item.itemNameAr}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">${item.qty}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">${formatEGP(item.unitPriceMillieme)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">${formatEGP(item.discountMillieme)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:left">${formatEGP(item.totalMillieme)}</td>
        </tr>`,
        )
        .join("");

      const html = `
        <html dir="rtl" lang="ar">
          <head><meta charset="utf-8"><title>فاتورة ${data.invoiceNumber}</title>
          <style>
            body{font-family:'Segoe UI',Tahoma,Arial;padding:20px;margin:0;direction:rtl}
            .header{text-align:center;margin-bottom:16px}
            .header h1{margin:0;font-size:18px}
            .header p{margin:2px 0;font-size:13px;color:#555}
            table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
            th{background:#f5f5f5;padding:6px 8px;border-bottom:2px solid #ddd;text-align:right}
            .totals{margin-top:12px;font-size:13px}
            .totals div{display:flex;justify-content:space-between;padding:3px 0}
            .totals .grand{font-weight:bold;font-size:15px;border-top:2px solid #333;padding-top:6px;margin-top:4px}
            .footer{text-align:center;margin-top:16px;font-size:12px;color:#888}
          </style></head>
          <body>
            <div class="header">
              <h1>${data.shop.shopName}</h1>
              ${data.shop.shopAddress ? `<p>${data.shop.shopAddress}</p>` : ""}
              ${data.shop.shopPhone ? `<p>${data.shop.shopPhone}</p>` : ""}
              <p>رقم الفاتورة: ${data.invoiceNumber}</p>
              ${data.cashierName ? `<p>الكاشير: ${data.cashierName}</p>` : ""}
              ${data.customerName ? `<p>العميل: ${data.customerName}</p>` : ""}
            </div>
            <table>
              <thead><tr>
                <th style="text-align:right">الصنف</th>
                <th style="text-align:center">الكمية</th>
                <th style="text-align:center">السعر</th>
                <th style="text-align:center">الخصم</th>
                <th style="text-align:left">الإجمالي</th>
              </tr></thead>
              <tbody>${itemsHtml}</tbody>
            </table>
            <div class="totals">
              <div><span>المجموع الفرعي</span><span>${formatEGP(data.subtotalMillieme)}</span></div>
              ${data.discountMillieme ? `<div><span>الخصم</span><span>${formatEGP(data.discountMillieme)}</span></div>` : ""}
              <div class="grand"><span>الإجمالي</span><span>${formatEGP(data.totalMillieme)}</span></div>
              <div><span>المدفوع</span><span>${formatEGP(data.paidMillieme)}</span></div>
            </div>
            <div class="footer">شكراً لزيارتكم</div>
          </body>
        </html>`;
      printHtml(html);
    } catch {
      toast.error("تعذر إرسال أمر الطباعة");
    }
  };

  const handleSendWhatsapp = async () => {
    if (!invoice) {
      return;
    }

    setWhatsappLoading(true);

    try {
      const pdfPath = await generateInvoicePdf(invoice.id);
      setWhatsappPdfPath(pdfPath);
      toast.success(`تم حفظ الفاتورة في: ${pdfPath}`);

      await openWhatsappWithInvoice({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
      });

      toast.success("تم فتح واتساب، اختر جهة الاتصال ثم أرفق ملف PDF");
    } catch (error) {
      toast.error(parseAppError(error).message_ar);
    } finally {
      setWhatsappLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent dir="rtl">
        <SheetHeader>
          <SheetTitle>
            {invoice?.invoice_number ?? "تفاصيل الفاتورة"}
          </SheetTitle>
          <SheetDescription>
            {invoice
              ? formatDate(invoice.created_at)
              : "جارٍ تحميل بيانات الفاتورة..."}
          </SheetDescription>
        </SheetHeader>

        {isLoading || !invoice ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">العميل</p>
                <p className="text-base font-medium">
                  {invoice.customer_name || "عميل عام"}
                </p>
              </div>
              <StatusBadge status={invoice.status} />
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-right text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <TableHeadCell>الصنف</TableHeadCell>
                    <TableHeadCell>الكمية</TableHeadCell>
                    <TableHeadCell>مرتجع</TableHeadCell>
                    <TableHeadCell>السعر</TableHeadCell>
                    <TableHeadCell>الخصم</TableHeadCell>
                    <TableHeadCell>الإجمالي</TableHeadCell>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <TableCell className="font-medium text-foreground">
                        {item.item_name_ar}
                      </TableCell>
                      <TableCell>{item.qty}</TableCell>
                      <TableCell>{item.returned_qty}</TableCell>
                      <TableCell>{formatEGP(item.unit_price_millieme)}</TableCell>
                      <TableCell>{formatEGP(item.discount_millieme)}</TableCell>
                      <TableCell>{formatEGP(item.total_millieme)}</TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
              <DetailSummaryRow
                label="المجموع الفرعي"
                value={formatEGP(invoice.subtotal_millieme)}
              />
              <DetailSummaryRow
                label="الخصم"
                value={formatEGP(invoice.discount_millieme)}
              />
              <Separator />
              <DetailSummaryRow
                label="الإجمالي"
                value={formatEGP(invoice.total_millieme)}
                strong
              />
              <DetailSummaryRow
                label="المدفوع"
                value={formatEGP(invoice.paid_millieme)}
              />
              <DetailSummaryRow
                label="المتبقي"
                value={formatEGP(getRemainingMillieme(invoice))}
              />
            </div>

            {whatsappPdfPath ? (
              <PdfPathDisplay pdfPath={whatsappPdfPath} />
            ) : null}

            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                variant="outline"
                onClick={() => void handlePrint()}
                disabled={whatsappLoading}
              >
                <Printer />
                طباعة الفاتورة
              </Button>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
                onClick={() => void handleSendWhatsapp()}
                disabled={whatsappLoading}
              >
                <WhatsAppIcon className="size-4" />
                {whatsappLoading ? "جارٍ الإرسال..." : "إرسال واتساب"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setReturnDialogOpen(true)}
                disabled={
                  invoice.status === "cancelled" ||
                  invoice.items.every((item) => getReturnableQty(item) <= 0)
                }
              >
                <RotateCcw />
                إنشاء مرتجع
              </Button>
            </div>

            <ReturnDialog
              open={returnDialogOpen}
              onOpenChange={setReturnDialogOpen}
              invoice={invoice}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailSummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${
        strong ? "text-base font-semibold" : ""
      }`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
