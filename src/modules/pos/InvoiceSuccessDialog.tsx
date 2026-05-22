import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatEGP } from "@/shared/utils/money";

export type SaleInvoiceSuccess = {
  invoice_id: number;
  invoice_number: string;
  total_millieme: number;
  paid_cash_millieme: number;
  paid_card_millieme: number;
  paid_total_millieme: number;
  change_millieme: number;
};

type InvoiceSuccessDialogProps = {
  open: boolean;
  invoice: SaleInvoiceSuccess | null;
  onOpenChange: (open: boolean) => void;
  onPrint: () => void;
  onNewInvoice: () => void;
};

export function InvoiceSuccessDialog({
  open,
  invoice,
  onOpenChange,
  onPrint,
  onNewInvoice,
}: InvoiceSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>تم حفظ الفاتورة بنجاح ✓</DialogTitle>
          <DialogDescription>
            {invoice ? `رقم الفاتورة: ${invoice.invoice_number}` : "تم حفظ الفاتورة."}
          </DialogDescription>
        </DialogHeader>

        {invoice ? (
          <div className="space-y-3 rounded-xl border bg-muted/30 p-4 text-right">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">إجمالي الفاتورة</span>
              <span className="font-semibold">{formatEGP(invoice.total_millieme)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">إجمالي المدفوع</span>
              <span className="font-semibold">{formatEGP(invoice.paid_total_millieme)}</span>
            </div>
            {invoice.change_millieme > 0 ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">الباقي</span>
                <span className="font-semibold">{formatEGP(invoice.change_millieme)}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="flex-row-reverse justify-start gap-2 bg-transparent p-0 pt-2">
          <Button autoFocus onClick={onNewInvoice}>
            فاتورة جديدة
          </Button>
          <Button variant="outline" onClick={onPrint}>
            طباعة الفاتورة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
