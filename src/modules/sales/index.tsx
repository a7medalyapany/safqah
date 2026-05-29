import { useDeferredValue, useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Clock3,
  CreditCard,
  Eye,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { parseAppError } from "@/modules/items/utils";
import { PdfPathDisplay } from "@/shared/components/PdfPathDisplay";
import { WhatsAppIcon } from "@/shared/components/WhatsAppIcon";
import { formatEGP } from "@/shared/utils/money";
import { invoke } from "@/shared/utils/invoke";

const PAGE_SIZE = 50;

type InvoiceStatus = "paid" | "deferred" | "partial" | "cancelled";
type PaymentMethod = "cash" | "card" | "deferred" | "split";
type RefundMethod = "cash" | "credit";

type InvoiceFilters = {
  dateFrom: string | null;
  dateTo: string | null;
  customerSearch: string | null;
  status: string | null;
  paymentMethod: string | null;
  limit: number;
  offset: number;
};

type InvoiceSummary = {
  id: number;
  invoice_number: string;
  customer_id: number | null;
  customer_name: string | null;
  total_millieme: number;
  paid_millieme: number;
  payment_method: PaymentMethod;
  status: InvoiceStatus;
  created_at: string;
};

type InvoiceStats = {
  total_count: number;
  paid_count: number;
  deferred_count: number;
  total_sales_millieme: number;
};

type InvoiceItemDetail = {
  id: number;
  invoice_id: number;
  item_id: number;
  item_name_ar: string;
  qty: number;
  returned_qty: number;
  unit_price_millieme: number;
  discount_millieme: number;
  total_millieme: number;
};

type InvoiceDetail = InvoiceSummary & {
  session_id: number;
  cashier_id: number;
  subtotal_millieme: number;
  discount_millieme: number;
  tax_millieme: number;
  notes: string | null;
  items: InvoiceItemDetail[];
};

type CreateReturnPayload = {
  originalInvoiceId: number;
  sessionId: number;
  items: {
    invoiceItemId: number;
    itemId: number;
    qty: number;
  }[];
  refundMethod: RefundMethod;
  notes: string | null;
};

type SaleReturn = {
  id: number;
  return_number: string;
  original_invoice_id: number;
  session_id: number;
  total_millieme: number;
  refund_method: RefundMethod;
  status: string;
  notes: string | null;
  created_at: string;
};

const statusLabels: Record<InvoiceStatus, string> = {
  paid: "مدفوع",
  deferred: "آجل",
  partial: "جزئي",
  cancelled: "ملغي",
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "كاش",
  card: "فيزا",
  deferred: "آجل",
  split: "مختلط",
};

export default function SalesPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(
    null,
  );

  const deferredCustomerSearch = useDeferredValue(customerSearch);

  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [dateFrom, dateTo, deferredCustomerSearch, status, paymentMethod]);

  const statsQuery = useQuery({
    queryKey: ["invoice-stats"],
    queryFn: () => invoke<InvoiceStats>("get_invoice_stats"),
    staleTime: 30 * 1000,
  });

  const invoicesQuery = useQuery({
    queryKey: [
      "invoices",
      dateFrom,
      dateTo,
      deferredCustomerSearch,
      status,
      paymentMethod,
      visibleLimit,
    ],
    queryFn: () =>
      invoke<InvoiceSummary[]>("list_invoices", {
        filters: buildFilters({
          dateFrom,
          dateTo,
          customerSearch: deferredCustomerSearch,
          status,
          paymentMethod,
          limit: visibleLimit,
          offset: 0,
        }),
      }),
    staleTime: 15 * 1000,
  });

  const detailQuery = useQuery({
    queryKey: ["invoice-detail", selectedInvoiceId],
    queryFn: () =>
      invoke<InvoiceDetail>("get_invoice_detail", {
        invoiceId: selectedInvoiceId,
      }),
    enabled: selectedInvoiceId !== null,
  });

  const stats = statsQuery.data ?? {
    total_count: 0,
    paid_count: 0,
    deferred_count: 0,
    total_sales_millieme: 0,
  };
  const invoices = invoicesQuery.data ?? [];
  const selectedInvoice = detailQuery.data ?? null;
  const hasMore = invoices.length >= visibleLimit;

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          فواتير المبيعات
        </h1>
        <p className="text-sm text-muted-foreground">
          متابعة فواتير البيع، حالات السداد، والمديونيات المرتبطة بالعملاء.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="إجمالي الفواتير"
          value={statsQuery.isLoading ? "..." : stats.total_count}
          icon={<ReceiptText className="size-5" />}
        />
        <StatCard
          title="فواتير مدفوعة"
          value={statsQuery.isLoading ? "..." : stats.paid_count}
          icon={<Banknote className="size-5" />}
        />
        <StatCard
          title="فواتير آجلة"
          value={statsQuery.isLoading ? "..." : stats.deferred_count}
          icon={<Clock3 className="size-5" />}
        />
        <StatCard
          title="إجمالي المبيعات"
          value={
            statsQuery.isLoading ? "..." : formatEGP(stats.total_sales_millieme)
          }
          icon={<CreditCard className="size-5" />}
        />
      </section>

      <Card className="border-none bg-transparent p-0 shadow-none ring-0">
        <CardContent className="space-y-4 px-0">
          <div className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-2 xl:grid-cols-5">
            <FilterField label="من تاريخ">
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </FilterField>
            <FilterField label="إلى تاريخ">
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </FilterField>
            <FilterField label="العميل">
              <div className="relative">
                <Search className="absolute inset-e-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  dir="rtl"
                  className="pe-9"
                  placeholder="ابحث باسم العميل..."
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                />
              </div>
            </FilterField>
            <FilterField label="الحالة">
              <select
                dir="rtl"
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">الكل</option>
                <option value="paid">مدفوع</option>
                <option value="deferred">آجل</option>
                <option value="partial">جزئي</option>
                <option value="cancelled">ملغي</option>
              </select>
            </FilterField>
            <FilterField label="طريقة الدفع">
              <select
                dir="rtl"
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              >
                <option value="">الكل</option>
                <option value="cash">كاش</option>
                <option value="card">فيزا</option>
                <option value="deferred">آجل</option>
              </select>
            </FilterField>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle>قائمة الفواتير</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-right">
                  <thead className="bg-muted/40 text-sm text-muted-foreground">
                    <tr>
                      <TableHead>رقم الفاتورة</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>المدفوع</TableHead>
                      <TableHead>الآجل</TableHead>
                      <TableHead>طريقة الدفع</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicesQuery.isLoading ? (
                      <LoadingRows />
                    ) : invoices.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-16">
                          <div className="flex flex-col items-center justify-center gap-3 text-center">
                            <ReceiptText className="size-10 text-muted-foreground" />
                            <p className="text-base font-medium">
                              لا توجد فواتير
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      invoices.map((invoice) => (
                        <tr
                          key={invoice.id}
                          className="border-t transition-colors hover:bg-muted/30"
                        >
                          <TableCell className="font-medium text-foreground">
                            {invoice.invoice_number}
                          </TableCell>
                          <TableCell>
                            {invoice.customer_name || "عميل عام"}
                          </TableCell>
                          <TableCell>
                            {formatEGP(invoice.total_millieme)}
                          </TableCell>
                          <TableCell>
                            {formatEGP(invoice.paid_millieme)}
                          </TableCell>
                          <TableCell>
                            {formatEGP(getRemainingMillieme(invoice))}
                          </TableCell>
                          <TableCell>
                            {paymentMethodLabels[invoice.payment_method] ??
                              invoice.payment_method}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={invoice.status} />
                          </TableCell>
                          <TableCell>
                            {formatDate(invoice.created_at)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setSelectedInvoiceId(invoice.id)}
                              aria-label="عرض تفاصيل الفاتورة"
                            >
                              <Eye />
                            </Button>
                          </TableCell>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {hasMore ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() =>
                  setVisibleLimit((current) => current + PAGE_SIZE)
                }
                disabled={invoicesQuery.isFetching}
              >
                تحميل المزيد
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <InvoiceDetailSheet
        open={selectedInvoiceId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedInvoiceId(null);
          }
        }}
        invoice={selectedInvoice}
        isLoading={detailQuery.isLoading}
      />
    </div>
  );
}

function buildFilters(params: {
  dateFrom: string;
  dateTo: string;
  customerSearch: string;
  status: string;
  paymentMethod: string;
  limit: number;
  offset: number;
}): InvoiceFilters {
  return {
    dateFrom: params.dateFrom || null,
    dateTo: params.dateTo || null,
    customerSearch: params.customerSearch.trim() || null,
    status: params.status || null,
    paymentMethod: params.paymentMethod || null,
    limit: params.limit,
    offset: params.offset,
  };
}

function InvoiceDetailSheet({
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
      await invoke(
        "print_receipt",
        { invoiceId: invoice.id },
        { toast: false },
      );
      toast.success("جاري الطباعة...");
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
      const pdfPath = await invoke<string>(
        "generate_invoice_pdf",
        { invoiceId: invoice.id },
        { toast: false },
      );
      setWhatsappPdfPath(pdfPath);
      toast.success(`تم حفظ الفاتورة في: ${pdfPath}`);

      await invoke(
        "open_whatsapp_with_invoice",
        {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
        },
        { toast: false },
      );

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
                    <TableHead>الصنف</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>مرتجع</TableHead>
                    <TableHead>السعر</TableHead>
                    <TableHead>الخصم</TableHead>
                    <TableHead>الإجمالي</TableHead>
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
                      <TableCell>
                        {formatEGP(item.unit_price_millieme)}
                      </TableCell>
                      <TableCell>{formatEGP(item.discount_millieme)}</TableCell>
                      <TableCell>{formatEGP(item.total_millieme)}</TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
              <SummaryRow
                label="المجموع الفرعي"
                value={formatEGP(invoice.subtotal_millieme)}
              />
              <SummaryRow
                label="الخصم"
                value={formatEGP(invoice.discount_millieme)}
              />
              <Separator />
              <SummaryRow
                label="الإجمالي"
                value={formatEGP(invoice.total_millieme)}
                strong
              />
              <SummaryRow
                label="المدفوع"
                value={formatEGP(invoice.paid_millieme)}
              />
              <SummaryRow
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

function ReturnDialog({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceDetail;
}) {
  const queryClient = useQueryClient();
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
      total + item.unit_price_millieme * (quantities[item.id] ?? 0),
    0,
  );

  const createReturnMutation = useMutation({
    mutationFn: (payload: CreateReturnPayload) =>
      invoke<SaleReturn>("create_return", { payload }, { toast: false }),
    onSuccess: async () => {
      toast.success("تم تسجيل المرتجع بنجاح");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({
          queryKey: ["invoice-detail", invoice.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["invoice-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["items"] }),
      ]);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

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

    createReturnMutation.mutate({
      originalInvoiceId: invoice.id,
      sessionId: invoice.session_id,
      items: selectedItems.map((item) => ({
        invoiceItemId: item.id,
        itemId: item.item_id,
        qty: quantities[item.id] ?? 1,
      })),
      refundMethod,
      notes: null,
    });
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
                    <TableHead>الصنف</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>الإجمالي</TableHead>
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
                          item.unit_price_millieme * (quantities[item.id] ?? 1),
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
                strong
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

        <DialogFooter>
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

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: ReactNode;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0">
        <div className="rounded-xl bg-primary/8 p-2 text-primary">{icon}</div>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-right">
        <p className="text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge variant="outline" className={cn(getStatusTone(status))}>
      {statusLabels[status] ?? status}
    </Badge>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        strong && "text-base font-semibold",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function LoadingRows() {
  return Array.from({ length: 6 }).map((_, index) => (
    <tr key={index} className="border-t">
      {Array.from({ length: 9 }).map((__, cellIndex) => (
        <td key={cellIndex} className="px-4 py-3">
          <Skeleton className="h-5 w-full max-w-24" />
        </td>
      ))}
    </tr>
  ));
}

function TableHead({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 text-right font-medium">{children}</th>;
}

function TableCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 align-middle ${className ?? ""}`}>{children}</td>
  );
}

function getStatusTone(status: InvoiceStatus) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (status === "deferred") {
    return "border-orange-200 bg-orange-100 text-orange-800";
  }

  if (status === "partial") {
    return "border-yellow-200 bg-yellow-100 text-yellow-800";
  }

  return "border-destructive/20 bg-destructive/10 text-destructive";
}

function getRemainingMillieme(
  invoice: Pick<InvoiceSummary, "total_millieme" | "paid_millieme">,
) {
  return Math.max(invoice.total_millieme - invoice.paid_millieme, 0);
}

function getReturnableQty(
  item: Pick<InvoiceItemDetail, "qty" | "returned_qty">,
) {
  return Math.max(item.qty - item.returned_qty, 0);
}

function formatDate(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
