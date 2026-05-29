import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PdfPathDisplay } from "@/shared/components/PdfPathDisplay";
import { WhatsAppIcon } from "@/shared/components/WhatsAppIcon";
import { formatEGP } from "@/shared/utils/money";

export type SaleInvoiceSuccess = {
  id: number;
  invoice_number: string;
  subtotal_millieme: number;
  discount_millieme: number;
  total_millieme: number;
  paid_millieme: number;
  status: "paid" | "deferred" | "partial" | "cancelled";
};

type InvoiceSuccessDialogProps = {
  open: boolean;
  invoice: SaleInvoiceSuccess | null;
  onOpenChange: (open: boolean) => void;
  onPrint: () => void;
  onWhatsapp: () => void;
  onNewInvoice: () => void;
  whatsappLoading: boolean;
  pdfPath: string | null;
};

export function InvoiceSuccessDialog({
  open,
  invoice,
  onOpenChange,
  onPrint,
  onWhatsapp,
  onNewInvoice,
  whatsappLoading,
  pdfPath,
}: InvoiceSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>تم حفظ الفاتورة بنجاح ✓</DialogTitle>
          <DialogDescription>
            {invoice
              ? `رقم الفاتورة: ${invoice.invoice_number}`
              : "تم حفظ الفاتورة."}
          </DialogDescription>
        </DialogHeader>

        {invoice ? (
          <div className="space-y-3 rounded-xl border bg-muted/30 p-4 text-right">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                إجمالي الفاتورة
              </span>
              <span className="font-semibold">
                {formatEGP(invoice.total_millieme)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                إجمالي المدفوع
              </span>
              <span className="font-semibold">
                {formatEGP(invoice.paid_millieme)}
              </span>
            </div>
            {invoice.paid_millieme > invoice.total_millieme ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">الباقي</span>
                <span className="font-semibold">
                  {formatEGP(invoice.paid_millieme - invoice.total_millieme)}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {pdfPath ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              ملف PDF جاهز للإرفاق
            </p>
            <PdfPathDisplay pdfPath={pdfPath} />
          </div>
        ) : null}

        <DialogFooter className="grid gap-2 bg-transparent p-0 pt-2 sm:grid-cols-3">
          <Button
            variant="outline"
            onClick={onPrint}
            disabled={whatsappLoading}
          >
            طباعة الفاتورة
          </Button>
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
            onClick={onWhatsapp}
            disabled={whatsappLoading || invoice === null}
          >
            <WhatsAppIcon className="size-4" />
            {whatsappLoading ? "جارٍ الإرسال..." : "إرسال واتساب"}
          </Button>
          <Button autoFocus onClick={onNewInvoice} disabled={whatsappLoading}>
            فاتورة جديدة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
