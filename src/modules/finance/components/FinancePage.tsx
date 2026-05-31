import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CollectPaymentDialog,
  DeferredInvoicesTable,
  ExpenseDialog,
  ExpensesSection,
  PaymentVoucherDialog,
  PaymentsSection,
  ReceiptVoucherDialog,
  ReceiptsSection,
  SummarySection,
} from "@/modules/finance/components/FinanceComponents";
import { DATE_FILTERS, TABS } from "@/modules/finance/constants";
import type {
  CashSummary,
  DateFilter,
  DeferredInvoiceSummary,
  ExpenseCategory,
  ExpenseWithCategory,
  PaymentWithEntity,
  TabId,
} from "@/modules/finance/types";
import { getDateRange } from "@/modules/finance/utils";
import type { Customer, Supplier } from "@/modules/parties/types";
import { useSessionStore, type SessionState } from "@/store/sessionSlice";
import { invoke } from "@/shared/utils/invoke";

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
