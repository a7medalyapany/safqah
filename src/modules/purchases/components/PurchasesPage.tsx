import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Clock3,
  Eye,
  FolderTree,
  PlusCircle,
  ReceiptText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CategoryManagerDialog } from "@/modules/items/categories";
import type { Supplier } from "@/modules/parties/types";
import {
  FilterField,
  formatDate,
  LoadingRows,
  PriceUpdateDialog,
  PurchaseDetailSheet,
  PurchaseFormDialog,
  StatCard,
  StatusBadge,
  TableCell,
  TableHead,
} from "@/modules/purchases/components/PurchaseComponents";
import { PURCHASES_PAGE_SIZE } from "@/modules/purchases/constants";
import type {
  PriceSuggestion,
  PurchaseDetail,
  PurchaseFilters,
  PurchaseStats,
  PurchaseSummary,
} from "@/modules/purchases/types";
import { formatEGP } from "@/shared/utils/money";
import { invoke } from "@/shared/utils/invoke";

export default function PurchasesPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(PURCHASES_PAGE_SIZE);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(
    null,
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [priceSuggestions, setPriceSuggestions] = useState<PriceSuggestion[]>(
    [],
  );
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);

  useEffect(() => {
    setVisibleLimit(PURCHASES_PAGE_SIZE);
  }, [dateFrom, dateTo, supplierId, status]);

  const statsQuery = useQuery({
    queryKey: ["purchases-stats"],
    queryFn: () => invoke<PurchaseStats>("get_purchase_stats"),
    staleTime: 30 * 1000,
  });

  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => invoke<Supplier[]>("list_suppliers", { search: null }),
    staleTime: 30 * 1000,
  });

  const purchasesQuery = useQuery({
    queryKey: ["purchases", dateFrom, dateTo, supplierId, status, visibleLimit],
    queryFn: () =>
      invoke<PurchaseSummary[]>("list_purchases", {
        filters: buildFilters({
          dateFrom,
          dateTo,
          supplierId,
          status,
          limit: visibleLimit,
          offset: 0,
        }),
      }),
    staleTime: 15 * 1000,
  });

  const detailQuery = useQuery({
    queryKey: ["purchase-detail", selectedPurchaseId],
    queryFn: () =>
      invoke<PurchaseDetail>("get_purchase_detail", {
        purchaseId: selectedPurchaseId,
      }),
    enabled: selectedPurchaseId !== null,
  });

  const stats = statsQuery.data ?? {
    total_count: 0,
    paid_count: 0,
    deferred_count: 0,
    total_purchases_millieme: 0,
  };
  const purchases = purchasesQuery.data ?? [];
  const selectedPurchase = detailQuery.data ?? null;
  const hasMore = purchases.length >= visibleLimit;

  const handleOpenPriceSuggestions = (suggestions: PriceSuggestion[]) => {
    if (suggestions.length === 0) {
      return;
    }

    setPriceSuggestions(suggestions);
    setIsPriceDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          فواتير المشتريات
        </h1>
        <p className="text-sm text-muted-foreground">
          تتبع فواتير الشراء، حالات السداد، ومتابعة الموردين من شاشة واحدة.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="إجمالي فواتير الشراء"
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
          title="إجمالي المشتريات"
          value={
            statsQuery.isLoading
              ? "..."
              : formatEGP(stats.total_purchases_millieme)
          }
          icon={<ReceiptText className="size-5" />}
        />
      </section>

      <Card className="border-none bg-transparent p-0 shadow-none ring-0">
        <CardContent className="space-y-4 px-0">
          <div className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,1fr))]">
            <div className="flex flex-col items-center justify-center gap-2 sm:flex-row-reverse sm:justify-start">
              <Button
                variant="outline"
                onClick={() => setIsCategoryManagerOpen(true)}
              >
                <FolderTree />
                إدارة التصنيفات
              </Button>
              <Button onClick={() => setIsCreateOpen(true)}>
                <PlusCircle />
                فاتورة شراء جديدة
              </Button>
            </div>
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
            <FilterField label="المورد">
              <select
                dir="rtl"
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
              >
                <option value="">جميع الموردين</option>
                {(suppliersQuery.data ?? []).map((supplier) => (
                  <option key={supplier.id} value={String(supplier.id)}>
                    {supplier.name}
                  </option>
                ))}
              </select>
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
                      <TableHead>المورد</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>المدفوع</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {purchasesQuery.isLoading ? (
                      <LoadingRows columns={7} />
                    ) : purchases.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16">
                          <div className="flex flex-col items-center justify-center gap-3 text-center">
                            <ReceiptText className="size-10 text-muted-foreground" />
                            <p className="text-base font-medium">
                              لا توجد فواتير
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      purchases.map((purchase) => (
                        <tr
                          key={purchase.id}
                          className="border-t transition-colors hover:bg-muted/30"
                        >
                          <TableCell className="font-medium text-foreground">
                            {purchase.invoice_number}
                          </TableCell>
                          <TableCell>
                            {purchase.supplier_name || "بدون مورد"}
                          </TableCell>
                          <TableCell>
                            {formatEGP(purchase.total_millieme)}
                          </TableCell>
                          <TableCell>
                            {formatEGP(purchase.paid_millieme)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={purchase.status} />
                          </TableCell>
                          <TableCell>
                            {formatDate(purchase.created_at)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setSelectedPurchaseId(purchase.id)}
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
                  setVisibleLimit((current) => current + PURCHASES_PAGE_SIZE)
                }
                disabled={purchasesQuery.isFetching}
              >
                تحميل المزيد
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <PurchaseFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSavedWithPriceSuggestions={handleOpenPriceSuggestions}
      />

      <CategoryManagerDialog
        open={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
      />

      <PurchaseDetailSheet
        open={selectedPurchaseId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPurchaseId(null);
          }
        }}
        purchase={selectedPurchase}
        isLoading={detailQuery.isLoading}
      />

      <PriceUpdateDialog
        open={isPriceDialogOpen}
        onOpenChange={setIsPriceDialogOpen}
        suggestions={priceSuggestions}
        onClear={() => setPriceSuggestions([])}
      />
    </div>
  );
}

function buildFilters(params: {
  dateFrom: string;
  dateTo: string;
  supplierId: string;
  status: string;
  limit: number;
  offset: number;
}): PurchaseFilters {
  return {
    dateFrom: params.dateFrom || null,
    dateTo: params.dateTo || null,
    supplierId: params.supplierId ? Number(params.supplierId) : null,
    status: params.status || null,
    limit: params.limit,
    offset: params.offset,
  };
}
