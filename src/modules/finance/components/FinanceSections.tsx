import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/modules/finance/constants";
import type { CashSummary, ExpenseWithCategory, PaymentMethod, PaymentWithEntity } from "@/modules/finance/types";
import { formatDate } from "@/modules/finance/utils";
import { formatEGP } from "@/shared/utils/money";
import { EmptyState, LoadingRows, SummaryCard, TableCell, TableHead } from "./FinancePrimitives";

export function ReceiptsSection({
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

export function PaymentsSection({
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

export function ExpensesSection({
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

export function SummarySection({
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
