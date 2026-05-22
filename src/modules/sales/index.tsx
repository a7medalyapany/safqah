import { useDeferredValue, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
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
import { formatEGP } from "@/shared/utils/money";

const PAGE_SIZE = 50;

type InvoiceStatus = "paid" | "deferred" | "partial" | "cancelled";
type PaymentMethod = "cash" | "card" | "deferred" | "split";

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
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);

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
        <h1 className="text-3xl font-semibold tracking-tight">فواتير المبيعات</h1>
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
          value={statsQuery.isLoading ? "..." : formatEGP(stats.total_sales_millieme)}
          icon={<CreditCard className="size-5" />}
        />
      </section>

      <Card className="border-none bg-transparent p-0 shadow-none ring-0">
        <CardContent className="space-y-4 px-0">
          <div className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))]">
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
                <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
                            <p className="text-base font-medium">لا توجد فواتير</p>
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
                          <TableCell>{invoice.customer_name || "عميل عام"}</TableCell>
                          <TableCell>{formatEGP(invoice.total_millieme)}</TableCell>
                          <TableCell>{formatEGP(invoice.paid_millieme)}</TableCell>
                          <TableCell>{formatEGP(getRemainingMillieme(invoice))}</TableCell>
                          <TableCell>
                            {paymentMethodLabels[invoice.payment_method] ??
                              invoice.payment_method}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={invoice.status} />
                          </TableCell>
                          <TableCell>{formatDate(invoice.created_at)}</TableCell>
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
                onClick={() => setVisibleLimit((current) => current + PAGE_SIZE)}
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
  const handlePrint = async () => {
    if (!invoice) {
      return;
    }

    try {
      await invoke("print_receipt", { invoiceId: invoice.id });
      toast.success("جاري الطباعة...");
    } catch {
      toast.error("تعذر إرسال أمر الطباعة");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent dir="rtl">
        <SheetHeader>
          <SheetTitle>{invoice?.invoice_number ?? "تفاصيل الفاتورة"}</SheetTitle>
          <SheetDescription>
            {invoice ? formatDate(invoice.created_at) : "جارٍ تحميل بيانات الفاتورة..."}
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
                      <TableCell>{formatEGP(item.unit_price_millieme)}</TableCell>
                      <TableCell>{formatEGP(item.discount_millieme)}</TableCell>
                      <TableCell>{formatEGP(item.total_millieme)}</TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
              <SummaryRow label="المجموع الفرعي" value={formatEGP(invoice.subtotal_millieme)} />
              <SummaryRow label="الخصم" value={formatEGP(invoice.discount_millieme)} />
              <Separator />
              <SummaryRow label="الإجمالي" value={formatEGP(invoice.total_millieme)} strong />
              <SummaryRow label="المدفوع" value={formatEGP(invoice.paid_millieme)} />
              <SummaryRow
                label="المتبقي"
                value={formatEGP(getRemainingMillieme(invoice))}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={() => void handlePrint()}
              >
                <Printer />
                طباعة الفاتورة
              </Button>
              <Button
                variant="outline"
                onClick={() => toast.info("سيتم ربط إنشاء المرتجع في T-026")}
              >
                <RotateCcw />
                إنشاء مرتجع
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
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
  return <td className={`px-4 py-3 align-middle ${className ?? ""}`}>{children}</td>;
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

function getRemainingMillieme(invoice: Pick<InvoiceSummary, "total_millieme" | "paid_millieme">) {
  return Math.max(invoice.total_millieme - invoice.paid_millieme, 0);
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
