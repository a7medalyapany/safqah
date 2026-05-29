import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Receipt } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { parseAppError } from "@/modules/items/utils";
import type { Customer, Supplier } from "@/modules/parties/types";
import { formatEGP, toMillieme } from "@/shared/utils/money";
import { useSessionStore, type SessionState } from "@/store/sessionSlice";
import { invoke } from "@/shared/utils/invoke";

type TabId = "receipts" | "payments" | "deferred" | "expenses" | "summary";

type DeferredInvoiceSummary = {
  invoice_id: number;
  invoice_number: string;
  customer_id: number;
  customer_name: string;
  total_millieme: number;
  paid_millieme: number;
  remaining_millieme: number;
  status: string;
  created_at: string;
  days_outstanding: number;
};
type PaymentMethod = "cash" | "card" | "bank";
type DateFilter = "today" | "week" | "month" | "all";

type PaymentWithEntity = {
  id: number;
  entity_type: string;
  entity_id: number;
  entity_name: string;
  amount_millieme: number;
  direction: string;
  method: string;
  reference_invoice_id: number | null;
  notes: string | null;
  session_id: number | null;
  created_at: string;
};

type ExpenseCategory = {
  id: number;
  name_ar: string;
  created_at: string;
};

type ExpenseWithCategory = {
  id: number;
  amount_millieme: number;
  category_id: number | null;
  category_name_ar: string | null;
  description: string | null;
  session_id: number | null;
  created_by: number;
  created_at: string;
};

type CashSummary = {
  total_sales_cash_millieme: number;
  total_expenses_millieme: number;
  total_payments_out_millieme: number;
  total_payments_in_millieme: number;
  net_cash_millieme: number;
};

const TABS: { id: TabId; label: string }[] = [
  { id: "receipts", label: "سندات القبض" },
  { id: "payments", label: "سندات الصرف" },
  { id: "deferred", label: "المديونيات" },
  { id: "expenses", label: "المصروفات" },
  { id: "summary", label: "ملخص الخزينة" },
];

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "كاش",
  card: "فيزا",
  bank: "تحويل بنكي",
};

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: "today", label: "اليوم" },
  { value: "week", label: "هذا الأسبوع" },
  { value: "month", label: "هذا الشهر" },
  { value: "all", label: "كل الوقت" },
];

function getDateRange(filter: DateFilter): {
  dateFrom: string | null;
  dateTo: string | null;
} {
  if (filter === "all") return { dateFrom: null, dateTo: null };

  const now = new Date();
  let start: Date;

  switch (filter) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week": {
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
      break;
    }
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  const year = start!.getFullYear();
  const month = String(start!.getMonth() + 1).padStart(2, "0");
  const day = String(start!.getDate()).padStart(2, "0");

  return { dateFrom: `${year}-${month}-${day}`, dateTo: null };
}

function relativeTime(days: number): string {
  if (days === 0) return "اليوم";
  if (days === 1) return "أمس";
  if (days < 7) return `${days} أيام`;
  if (days < 30) return `${Math.floor(days / 7)} أسبوع`;
  if (days < 365) return `${Math.floor(days / 30)} شهر`;
  return `${Math.floor(days / 365)} سنة`;
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

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<TabId>("receipts");
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [collectPaymentInvoice, setCollectPaymentInvoice] =
    useState<DeferredInvoiceSummary | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");

  const activeSession = useSessionStore(
    (state: SessionState) => state.activeSession,
  );
  const sessionId = activeSession?.id ?? null;

  const { dateFrom, dateTo } = getDateRange(dateFilter);

  const customersQuery = useQuery({
    queryKey: ["customers"],
    queryFn: () => invoke<Customer[]>("list_customers"),
  });

  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => invoke<Supplier[]>("list_suppliers"),
  });

  const receiptsQuery = useQuery({
    queryKey: ["payments", "in", "customer"],
    queryFn: () =>
      invoke<PaymentWithEntity[]>("list_payments", {
        direction: "in",
        entityType: "customer",
      }),
    enabled: activeTab === "receipts",
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments", "out", "supplier"],
    queryFn: () =>
      invoke<PaymentWithEntity[]>("list_payments", {
        direction: "out",
        entityType: "supplier",
      }),
    enabled: activeTab === "payments",
  });

  const expensesQuery = useQuery({
    queryKey: ["expenses", dateFrom, dateTo],
    queryFn: () =>
      invoke<ExpenseWithCategory[]>("list_expenses", {
        dateFrom,
        dateTo,
      }),
    enabled: activeTab === "expenses",
  });

  const expenseCategoriesQuery = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => invoke<ExpenseCategory[]>("list_expense_categories"),
  });

  const summaryQuery = useQuery({
    queryKey: ["cash-summary", sessionId, dateFrom, dateTo],
    queryFn: () =>
      invoke<CashSummary>("get_cash_summary", {
        sessionId,
        dateFrom,
        dateTo,
      }),
    enabled: activeTab === "summary",
  });

  const deferredInvoicesQuery = useQuery({
    queryKey: ["deferred-invoices"],
    queryFn: () =>
      invoke<DeferredInvoiceSummary[]>("get_all_deferred_invoices"),
    enabled: activeTab === "deferred",
  });

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">المالية</h1>
        <p className="text-sm text-muted-foreground">
          إدارة سندات القبض والصرف، تسجيل المصروفات، ومتابعة الخزينة.
        </p>
      </header>

      <div className="flex items-center justify-between gap-4 border-b pb-2">
        <div className="flex gap-1">
          {TABS.map(({ id, label }) => (
            <Button
              key={id}
              variant={activeTab === id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(id)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div>
          {activeTab === "receipts" && (
            <Button size="sm" onClick={() => setReceiptDialogOpen(true)}>
              <Plus /> سند قبض جديد
            </Button>
          )}
          {activeTab === "payments" && (
            <Button size="sm" onClick={() => setPaymentDialogOpen(true)}>
              <Plus /> سند صرف جديد
            </Button>
          )}
          {activeTab === "expenses" && (
            <Button size="sm" onClick={() => setExpenseDialogOpen(true)}>
              <Plus /> مصروف جديد
            </Button>
          )}
          {activeTab === "summary" && (
            <div className="flex gap-1">
              {DATE_FILTERS.map(({ value, label }) => (
                <Button
                  key={value}
                  variant={dateFilter === value ? "default" : "outline"}
                  size="xs"
                  onClick={() => setDateFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeTab === "receipts" && (
        <ReceiptsSection
          receipts={receiptsQuery.data ?? []}
          isLoading={receiptsQuery.isLoading}
        />
      )}
      {activeTab === "payments" && (
        <PaymentsSection
          payments={paymentsQuery.data ?? []}
          isLoading={paymentsQuery.isLoading}
        />
      )}
      {activeTab === "deferred" && (
        <DeferredInvoicesTable
          invoices={deferredInvoicesQuery.data ?? []}
          isLoading={deferredInvoicesQuery.isLoading}
          onCollectPayment={setCollectPaymentInvoice}
        />
      )}
      {activeTab === "expenses" && (
        <ExpensesSection
          expenses={expensesQuery.data ?? []}
          isLoading={expensesQuery.isLoading}
        />
      )}
      {activeTab === "summary" && (
        <SummarySection
          summary={summaryQuery.data}
          isLoading={summaryQuery.isLoading}
        />
      )}

      <ReceiptVoucherDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        customers={customersQuery.data ?? []}
        sessionId={sessionId}
      />

      <PaymentVoucherDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        suppliers={suppliersQuery.data ?? []}
        sessionId={sessionId}
      />

      <ExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        categories={expenseCategoriesQuery.data ?? []}
        sessionId={sessionId}
      />

      <CollectPaymentDialog
        invoice={collectPaymentInvoice}
        onOpenChange={(open) => {
          if (!open) {
            setCollectPaymentInvoice(null);
          }
        }}
        sessionId={sessionId}
      />
    </div>
  );
}

// ── Tab Sections ───────────────────────────────────────────────────────────

function ReceiptsSection({
  receipts,
  isLoading,
}: {
  receipts: PaymentWithEntity[];
  isLoading: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle>سندات القبض</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-right">
            <thead className="bg-muted/40 text-sm text-muted-foreground">
              <tr>
                <TableHead>التاريخ</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الطريقة</TableHead>
                <TableHead>ملاحظات</TableHead>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <LoadingRows cols={5} />
              ) : receipts.length === 0 ? (
                <EmptyState colSpan={5} message="لا توجد سندات قبض" />
              ) : (
                receipts.map((receipt) => (
                  <tr
                    key={receipt.id}
                    className="border-t transition-colors hover:bg-muted/30"
                  >
                    <TableCell>{formatDate(receipt.created_at)}</TableCell>
                    <TableCell className="font-medium text-foreground">
                      {receipt.entity_name}
                    </TableCell>
                    <TableCell>{formatEGP(receipt.amount_millieme)}</TableCell>
                    <TableCell>
                      {PAYMENT_METHOD_LABELS[receipt.method as PaymentMethod] ??
                        receipt.method}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {receipt.notes || "—"}
                    </TableCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentsSection({
  payments,
  isLoading,
}: {
  payments: PaymentWithEntity[];
  isLoading: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle>سندات الصرف</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-right">
            <thead className="bg-muted/40 text-sm text-muted-foreground">
              <tr>
                <TableHead>التاريخ</TableHead>
                <TableHead>المورد</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الطريقة</TableHead>
                <TableHead>ملاحظات</TableHead>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <LoadingRows cols={5} />
              ) : payments.length === 0 ? (
                <EmptyState colSpan={5} message="لا توجد سندات صرف" />
              ) : (
                payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-t transition-colors hover:bg-muted/30"
                  >
                    <TableCell>{formatDate(payment.created_at)}</TableCell>
                    <TableCell className="font-medium text-foreground">
                      {payment.entity_name}
                    </TableCell>
                    <TableCell>{formatEGP(payment.amount_millieme)}</TableCell>
                    <TableCell>
                      {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ??
                        payment.method}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {payment.notes || "—"}
                    </TableCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ExpensesSection({
  expenses,
  isLoading,
}: {
  expenses: ExpenseWithCategory[];
  isLoading: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle>المصروفات</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-right">
            <thead className="bg-muted/40 text-sm text-muted-foreground">
              <tr>
                <TableHead>التاريخ</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الوصف</TableHead>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <LoadingRows cols={4} />
              ) : expenses.length === 0 ? (
                <EmptyState colSpan={4} message="لا توجد مصروفات" />
              ) : (
                expenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="border-t transition-colors hover:bg-muted/30"
                  >
                    <TableCell>{formatDate(expense.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {expense.category_name_ar || "متنوعة"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatEGP(expense.amount_millieme)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {expense.description || "—"}
                    </TableCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SummarySection({
  summary,
  isLoading,
}: {
  summary: CashSummary | undefined;
  isLoading: boolean;
}) {
  const s = summary ?? {
    total_sales_cash_millieme: 0,
    total_expenses_millieme: 0,
    total_payments_out_millieme: 0,
    total_payments_in_millieme: 0,
    net_cash_millieme: 0,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard
          title="إجمالي المبيعات النقدية"
          value={formatEGP(s.total_sales_cash_millieme)}
          tone="green"
          isLoading={isLoading}
        />
        <SummaryCard
          title="إجمالي المصروفات"
          value={formatEGP(s.total_expenses_millieme)}
          tone="red"
          isLoading={isLoading}
        />
        <SummaryCard
          title="إجمالي المدفوع للموردين"
          value={formatEGP(s.total_payments_out_millieme)}
          tone="orange"
          isLoading={isLoading}
        />
        <SummaryCard
          title="إجمالي المستلم من العملاء"
          value={formatEGP(s.total_payments_in_millieme)}
          tone="blue"
          isLoading={isLoading}
        />
      </div>

      <Card
        className={cn(
          "border-2",
          s.net_cash_millieme >= 0
            ? "border-emerald-200 bg-emerald-50"
            : "border-red-200 bg-red-50",
        )}
      >
        <CardContent className="flex flex-col items-center justify-center gap-2 py-8">
          <p className="text-lg text-muted-foreground">صافي الخزينة</p>
          <p
            className={cn(
              "text-4xl font-bold",
              s.net_cash_millieme >= 0 ? "text-emerald-700" : "text-red-700",
            )}
          >
            {formatEGP(s.net_cash_millieme)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Dialogs ────────────────────────────────────────────────────────────────

function ReceiptVoucherDialog({
  open,
  onOpenChange,
  customers,
  sessionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  sessionId: number | null;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");

  const filtered = customers.filter((c) => c.name.includes(search));
  const selected = customers.find((c) => c.id === selectedId);
  const maxMillieme = selected ? Math.max(selected.balance_millieme, 0) : 0;

  const mutation = useMutation({
    mutationFn: () =>
      invoke(
        "record_customer_payment",
        {
          customerId: selectedId,
          amountMillieme: toMillieme(amount),
          method,
          notes: notes.trim() || null,
          sessionId,
        },
        { toast: false },
      ),
    onSuccess: async () => {
      toast.success("تم تسجيل سند القبض بنجاح");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["cash-summary"] }),
      ]);
      setSelectedId(null);
      setSearch("");
      setAmount("");
      setNotes("");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedId) {
      toast.error("اختر عميلاً");
      return;
    }

    if (!amount || toMillieme(amount) <= 0) {
      toast.error("المبلغ يجب أن يكون أكبر من صفر");
      return;
    }

    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>سند قبض جديد</DialogTitle>
          <DialogDescription>تسجيل مبلغ مستلم من عميل.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              اختر عميل <span className="text-destructive">*</span>
            </label>
            <Input
              dir="rtl"
              placeholder="ابحث باسم العميل..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedId(null);
              }}
            />
            {search && (
              <div className="max-h-40 overflow-y-auto rounded-lg border">
                {filtered.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    لا توجد نتائج
                  </p>
                ) : (
                  filtered.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className={cn(
                        "w-full px-3 py-2 text-right text-sm transition-colors hover:bg-muted",
                        selectedId === customer.id &&
                          "bg-primary/10 font-medium",
                      )}
                      onClick={() => {
                        setSelectedId(customer.id);
                        setSearch(customer.name);
                      }}
                    >
                      {customer.name}
                    </button>
                  ))
                )}
              </div>
            )}
            {selected && selected.balance_millieme > 0 && (
              <p className="text-sm text-orange-600">
                المديونية الحالية: {formatEGP(selected.balance_millieme)}
              </p>
            )}
          </div>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              المبلغ المستلم <span className="text-destructive">*</span>
            </span>
            <Input
              dir="rtl"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              max={
                maxMillieme > 0 ? (maxMillieme / 1000).toString() : undefined
              }
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              طريقة الاستلام
            </span>
            <select
              dir="rtl"
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as PaymentMethod)
              }
            >
              <option value="cash">كاش</option>
              <option value="card">فيزا</option>
              <option value="bank">تحويل بنكي</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              ملاحظات
            </span>
            <textarea
              dir="rtl"
              className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          <DialogFooter className="flex-row-reverse justify-start gap-2 bg-transparent p-0 pt-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              حفظ السند
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentVoucherDialog({
  open,
  onOpenChange,
  suppliers,
  sessionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Supplier[];
  sessionId: number | null;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");

  const filtered = suppliers.filter((s) => s.name.includes(search));
  const selected = suppliers.find((s) => s.id === selectedId);

  const mutation = useMutation({
    mutationFn: () =>
      invoke(
        "record_supplier_payment",
        {
          supplierId: selectedId,
          amountMillieme: toMillieme(amount),
          method,
          notes: notes.trim() || null,
          sessionId,
        },
        { toast: false },
      ),
    onSuccess: async () => {
      toast.success("تم تسجيل سند الصرف بنجاح");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
        queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
        queryClient.invalidateQueries({ queryKey: ["cash-summary"] }),
      ]);
      setSelectedId(null);
      setSearch("");
      setAmount("");
      setNotes("");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedId) {
      toast.error("اختر مورداً");
      return;
    }

    if (!amount || toMillieme(amount) <= 0) {
      toast.error("المبلغ يجب أن يكون أكبر من صفر");
      return;
    }

    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>سند صرف جديد</DialogTitle>
          <DialogDescription>تسجيل مبلغ مدفوع لمورد.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              اختر مورد <span className="text-destructive">*</span>
            </label>
            <Input
              dir="rtl"
              placeholder="ابحث باسم المورد..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedId(null);
              }}
            />
            {search && (
              <div className="max-h-40 overflow-y-auto rounded-lg border">
                {filtered.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    لا توجد نتائج
                  </p>
                ) : (
                  filtered.map((supplier) => (
                    <button
                      key={supplier.id}
                      type="button"
                      className={cn(
                        "w-full px-3 py-2 text-right text-sm transition-colors hover:bg-muted",
                        selectedId === supplier.id &&
                          "bg-primary/10 font-medium",
                      )}
                      onClick={() => {
                        setSelectedId(supplier.id);
                        setSearch(supplier.name);
                      }}
                    >
                      {supplier.name}
                    </button>
                  ))
                )}
              </div>
            )}
            {selected && selected.balance_millieme > 0 && (
              <p className="text-sm text-orange-600">
                المستحق للمورد: {formatEGP(selected.balance_millieme)}
              </p>
            )}
          </div>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              المبلغ المدفوع <span className="text-destructive">*</span>
            </span>
            <Input
              dir="rtl"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              طريقة الدفع
            </span>
            <select
              dir="rtl"
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as PaymentMethod)
              }
            >
              <option value="cash">كاش</option>
              <option value="card">فيزا</option>
              <option value="bank">تحويل بنكي</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              ملاحظات
            </span>
            <textarea
              dir="rtl"
              className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          <DialogFooter className="flex-row-reverse justify-start gap-2 bg-transparent p-0 pt-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              حفظ السند
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseDialog({
  open,
  onOpenChange,
  categories,
  sessionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExpenseCategory[];
  sessionId: number | null;
}) {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      invoke(
        "create_expense",
        {
          amountMillieme: toMillieme(amount),
          categoryId: categoryId ? Number(categoryId) : null,
          description: description.trim() || null,
          sessionId,
        },
        { toast: false },
      ),
    onSuccess: async () => {
      toast.success("تم تسجيل المصروف بنجاح");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["cash-summary"] }),
      ]);
      setCategoryId("");
      setAmount("");
      setDescription("");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!amount || toMillieme(amount) <= 0) {
      toast.error("المبلغ يجب أن يكون أكبر من صفر");
      return;
    }

    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>مصروف جديد</DialogTitle>
          <DialogDescription>تسجيل مصروف تشغيلي.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              نوع المصروف <span className="text-destructive">*</span>
            </span>
            <select
              dir="rtl"
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">اختر النوع</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name_ar}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              المبلغ <span className="text-destructive">*</span>
            </span>
            <Input
              dir="rtl"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              وصف
            </span>
            <textarea
              dir="rtl"
              className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <DialogFooter className="flex-row-reverse justify-start gap-2 bg-transparent p-0 pt-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              حفظ
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── DeferredInvoicesTable ────────────────────────────────────────────────────

function DeferredInvoicesTable({
  invoices,
  isLoading,
  onCollectPayment,
}: {
  invoices: DeferredInvoiceSummary[];
  isLoading: boolean;
  onCollectPayment: (invoice: DeferredInvoiceSummary) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle>الفواتير الآجلة</CardTitle>
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
                <TableHead>المتبقي</TableHead>
                <TableHead>منذ</TableHead>
                <TableHead>الإجراءات</TableHead>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <LoadingRows cols={7} />
              ) : invoices.length === 0 ? (
                <EmptyState colSpan={7} message="لا توجد فواتير آجلة" />
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv.invoice_id}
                    className="border-t transition-colors hover:bg-muted/30"
                  >
                    <TableCell className="font-medium text-foreground">
                      {inv.invoice_number}
                    </TableCell>
                    <TableCell>{inv.customer_name}</TableCell>
                    <TableCell>{formatEGP(inv.total_millieme)}</TableCell>
                    <TableCell>{formatEGP(inv.paid_millieme)}</TableCell>
                    <TableCell>
                      <span className="font-medium text-destructive">
                        {formatEGP(inv.remaining_millieme)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {relativeTime(inv.days_outstanding)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCollectPayment(inv)}
                      >
                        تسجيل دفعة
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
  );
}

// ── CollectPaymentDialog ────────────────────────────────────────────────────

function CollectPaymentDialog({
  invoice,
  onOpenChange,
  sessionId,
}: {
  invoice: DeferredInvoiceSummary | null;
  onOpenChange: (open: boolean) => void;
  sessionId: number | null;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");

  useEffect(() => {
    if (invoice) {
      setAmount("");
      setMethod("cash");
    }
  }, [invoice]);

  const mutation = useMutation({
    mutationFn: () =>
      invoke<{ status: string; paid_millieme: number }>(
        "record_invoice_payment",
        {
          invoiceId: invoice!.invoice_id,
          amountMillieme: toMillieme(amount),
          method,
          sessionId,
        },
      ),
    onSuccess: (result) => {
      if (result.status === "paid") {
        toast.success("تم سداد الفاتورة بالكامل");
      } else {
        toast.success("تم تسجيل الدفعة");
      }

      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deferred-invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
        queryClient.invalidateQueries({ queryKey: ["cash-summary"] }),
      ]);

      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!amount || toMillieme(amount) <= 0) {
      toast.error("المبلغ يجب أن يكون أكبر من صفر");
      return;
    }

    mutation.mutate();
  };

  const remaining = invoice ? invoice.remaining_millieme : 0;
  const maxEgp = remaining / 1000;

  return (
    <Dialog
      open={invoice !== null}
      onOpenChange={(open) => {
        if (!open) {
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>تسجيل دفعة</DialogTitle>
          <DialogDescription>تسجيل دفعة على فاتورة آجلة.</DialogDescription>
        </DialogHeader>

        {invoice && (
          <div className="mb-2 space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">العميل</span>
              <span className="font-medium">{invoice.customer_name}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">رقم الفاتورة</span>
              <span className="font-medium">{invoice.invoice_number}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">الإجمالي</span>
              <span>{formatEGP(invoice.total_millieme)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">المدفوع</span>
              <span>{formatEGP(invoice.paid_millieme)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">المتبقي</span>
              <span className="font-medium text-destructive">
                {formatEGP(remaining)}
              </span>
            </div>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              المبلغ المستلم <span className="text-destructive">*</span>
            </span>
            <Input
              dir="rtl"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              max={maxEgp > 0 ? maxEgp : undefined}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              طريقة الاستلام
            </span>
            <select
              dir="rtl"
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as PaymentMethod)
              }
            >
              <option value="cash">كاش</option>
              <option value="card">فيزا</option>
              <option value="bank">تحويل</option>
            </select>
          </label>

          <DialogFooter className="flex-row-reverse justify-start gap-2 bg-transparent p-0 pt-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              تسجيل الدفعة
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function SummaryCard({
  title,
  value,
  tone,
  isLoading,
}: {
  title: string;
  value: string;
  tone: "green" | "red" | "orange" | "blue";
  isLoading: boolean;
}) {
  const tones: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <Card className={cn("border", tones[tone])}>
      <CardContent className="space-y-1 p-4 text-center">
        <p className="text-xs font-medium opacity-80">{title}</p>
        <p className="text-xl font-bold">{isLoading ? "..." : value}</p>
      </CardContent>
    </Card>
  );
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
    <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>
  );
}

function LoadingRows({ cols }: { cols: number }) {
  return Array.from({ length: 5 }).map((_, index) => (
    <tr key={index} className="border-t">
      {Array.from({ length: cols }).map((__, cellIndex) => (
        <td key={cellIndex} className="px-4 py-3">
          <Skeleton className="h-5 w-full max-w-24" />
        </td>
      ))}
    </tr>
  ));
}

function EmptyState({
  colSpan,
  message,
}: {
  colSpan: number;
  message: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-16">
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <Receipt className="size-10 text-muted-foreground" />
          <p className="text-base font-medium">{message}</p>
        </div>
      </td>
    </tr>
  );
}
