import { useDeferredValue, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  BadgePlus,
  Boxes,
  CircleAlert,
  ClipboardCheck,
  Clock,
  Edit3,
  FolderTree,
  PackageSearch,
  Search,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ItemFormDialog } from "@/modules/items/ItemFormDialog";
import { DeleteConfirmDialog } from "@/modules/items/DeleteConfirmDialog";
import { StockAdjustmentDialog } from "@/modules/items/StockAdjustmentDialog";
import { CategoryManagerDialog } from "@/modules/items/categories";
import type { Category, Item, StockMovement } from "@/modules/items/types";
import { getItemStockTone } from "@/modules/items/utils";
import { useBarcodeScanner } from "@/shared/hooks/useBarcodeScanner";
import { formatEGP } from "@/shared/utils/money";
import { invoke } from "@/shared/utils/invoke";

export default function ItemsPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [historyItem, setHistoryItem] = useState<Item | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<Item | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const isScannerEnabled =
    !isCreateOpen &&
    !editingItem &&
    !deletingItem &&
    !isCategoryManagerOpen &&
    !historyItem &&
    !adjustingItem;

  const deferredSearch = useDeferredValue(search);
  const selectedCategoryId = categoryId ? Number(categoryId) : null;

  useBarcodeScanner((barcode) => {
    setSearch(barcode);
  }, isScannerEnabled);

  const simulateScannerInput = () => {
    for (const key of "1234567890") {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true }),
      );
    }

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  };

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => invoke<Category[]>("list_categories"),
    staleTime: 30 * 1000,
  });

  const statsQuery = useQuery({
    queryKey: ["items-stats"],
    queryFn: () =>
      invoke<Item[]>("list_items", { search: null, categoryId: null }),
    staleTime: 30 * 1000,
  });

  const itemsQuery = useQuery({
    queryKey: ["items", deferredSearch, selectedCategoryId],
    queryFn: () =>
      invoke<Item[]>("list_items", {
        search: deferredSearch.trim() || null,
        categoryId: selectedCategoryId,
      }),
    staleTime: 30 * 1000,
  });

  const statsItems = statsQuery.data ?? [];
  const stats = {
    totalItems: statsItems.length,
    totalStock: statsItems.reduce((sum, item) => sum + item.current_stock, 0),
    lowStock: statsItems.filter((item) => item.current_stock <= item.min_stock)
      .length,
    outOfStock: statsItems.filter((item) => item.current_stock <= 0).length,
  };

  const items = itemsQuery.data ?? [];
  const isLoading = itemsQuery.isLoading || statsQuery.isLoading;

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">إدارة الأصناف</h1>
        <p className="text-sm text-muted-foreground">
          راقب المخزون، حدّث الأسعار، وأدر بيانات الأصناف من مكان واحد.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="إجمالي الأصناف"
          value={stats.totalItems}
          icon={<Boxes className="size-5" />}
        />
        <StatCard
          title="إجمالي الكميات"
          value={stats.totalStock}
          icon={<PackageSearch className="size-5" />}
        />
        <StatCard
          title="مخزون منخفض"
          value={stats.lowStock}
          icon={<CircleAlert className="size-5" />}
        />
        <StatCard
          title="نافذ المخزون"
          value={stats.outOfStock}
          icon={<Trash2 className="size-5" />}
        />
      </section>

      <Card className="border-none bg-transparent p-0 shadow-none ring-0">
        <CardContent className="space-y-4 px-0">
          <div className="flex flex-col-reverse gap-3 rounded-2xl border bg-card p-4 lg:flex-row-reverse lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row-reverse">
              <div className="relative flex-1">
                <Search className="absolute inset-e-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  dir="rtl"
                  className="pe-9"
                  placeholder="ابحث بالاسم أو الباركود..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <select
                dir="rtl"
                className="h-8 min-w-48 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">جميع التصنيفات</option>
                {(categoriesQuery.data ?? []).map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name_ar}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button
                variant="outline"
                onClick={() => setIsCategoryManagerOpen(true)}
              >
                <FolderTree />
                إدارة التصنيفات
              </Button>
              <Button onClick={() => setIsCreateOpen(true)}>
                <BadgePlus />
                إضافة صنف جديد
              </Button>
            </div>
          </div>

          <div className="flex justify-start">
            <Button variant="outline" onClick={simulateScannerInput}>
              اختبار قارئ الباركود
            </Button>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle>قائمة الأصناف</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-right">
                  <thead className="bg-muted/40 text-sm text-muted-foreground">
                    <tr>
                      <TableHead>الاسم</TableHead>
                      <TableHead>اللون</TableHead>
                      <TableHead>المقاس</TableHead>
                      <TableHead>الباركود</TableHead>
                      <TableHead>الكمية</TableHead>
                      <TableHead>سعر الشراء</TableHead>
                      <TableHead>سعر البيع</TableHead>
                      <TableHead>التصنيف</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <LoadingRows />
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-16">
                          <div className="flex flex-col items-center justify-center gap-3 text-center">
                            <PackageSearch className="size-10 text-muted-foreground" />
                            <p className="text-base font-medium">
                              لا توجد أصناف
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t transition-colors hover:bg-muted/30"
                        >
                          <TableCell className="font-medium text-foreground">
                            <div className="space-y-1">
                              <p>{item.name_ar}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.unit}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{item.color || "—"}</TableCell>
                          <TableCell>{item.size || "—"}</TableCell>
                          <TableCell>{item.barcode || "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getItemStockTone(item)}
                            >
                              {item.current_stock}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatEGP(item.buy_price_millieme)}
                          </TableCell>
                          <TableCell>
                            {formatEGP(item.sell_price_millieme)}
                          </TableCell>
                          <TableCell>
                            {getCategoryName(
                              item.category_id,
                              categoriesQuery.data,
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-row-reverse justify-start gap-2">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setEditingItem(item)}
                                aria-label="تعديل الصنف"
                              >
                                <Edit3 />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setHistoryItem(item)}
                                aria-label="حركة المخزون"
                              >
                                <Clock />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setAdjustingItem(item)}
                                aria-label="تسوية جرد"
                              >
                                <ClipboardCheck />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeletingItem(item)}
                                aria-label="حذف الصنف"
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          </TableCell>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <ItemFormDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      <ItemFormDialog
        item={editingItem}
        open={Boolean(editingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
          }
        }}
      />

      <DeleteConfirmDialog
        item={deletingItem}
        open={Boolean(deletingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingItem(null);
          }
        }}
      />

      <CategoryManagerDialog
        open={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
      />

      <StockMovementsSheet
        open={Boolean(historyItem)}
        onOpenChange={(open) => {
          if (!open) {
            setHistoryItem(null);
          }
        }}
        item={historyItem}
      />

      <StockAdjustmentDialog
        open={Boolean(adjustingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustingItem(null);
          }
        }}
        item={adjustingItem}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
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

function getCategoryName(categoryId: number | null, categories?: Category[]) {
  if (!categoryId) {
    return "—";
  }

  return (
    categories?.find((category) => category.id === categoryId)?.name_ar ?? "—"
  );
}

const MOVEMENTS_PAGE_SIZE = 20;

const movementTypeLabels: Record<StockMovement["movement_type"], string> = {
  sale: "بيع",
  purchase: "شراء",
  return: "مرتجع",
  adjustment: "تسوية جرد",
};

function StockMovementsSheet({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
}) {
  const [visibleLimit, setVisibleLimit] = useState(MOVEMENTS_PAGE_SIZE);

  useEffect(() => {
    if (item) {
      setVisibleLimit(MOVEMENTS_PAGE_SIZE);
    }
  }, [item?.id]);

  const movementsQuery = useQuery({
    queryKey: ["item-movements", item?.id, visibleLimit],
    queryFn: () =>
      invoke<StockMovement[]>("get_item_movements", {
        itemId: item?.id,
        limit: visibleLimit,
      }),
    enabled: Boolean(item) && open,
    staleTime: 15 * 1000,
  });

  const movements = movementsQuery.data ?? [];
  const hasMore = movements.length >= visibleLimit;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent dir="rtl">
        <SheetHeader>
          <SheetTitle>
            {item ? `حركة المخزون — ${item.name_ar}` : "حركة المخزون"}
          </SheetTitle>
          <SheetDescription>
            {item ? "سجل تدفق المخزون لهذا الصنف." : "جارٍ تحميل الصنف..."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Badge
              variant="outline"
              className={item ? getItemStockTone(item) : ""}
            >
              {item
                ? `الرصيد الحالي: ${item.current_stock} قطعة`
                : "الرصيد الحالي: —"}
            </Badge>
          </div>

          {movementsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
              <PackageSearch className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                لا توجد حركات مخزون لهذا الصنف
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {movements.map((movement) => {
                const isPositive = movement.delta > 0;
                const deltaLabel = `${isPositive ? "+" : ""}${movement.delta}`;
                const referenceTarget =
                  movement.movement_type === "purchase"
                    ? "/purchases"
                    : "/sales";
                const canLinkReference =
                  movement.movement_type === "purchase" ||
                  movement.movement_type === "sale";

                return (
                  <div
                    key={movement.id}
                    className="rounded-lg border bg-muted/20 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 rounded-full p-2",
                          isPositive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {isPositive ? (
                          <ArrowUp className="size-4" />
                        ) : (
                          <ArrowDown className="size-4" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">
                            {movementTypeLabels[movement.movement_type]}
                          </span>
                          <span
                            className={cn(
                              "font-semibold",
                              isPositive
                                ? "text-emerald-700"
                                : "text-destructive",
                            )}
                          >
                            {deltaLabel}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>المرجع:</span>
                            {movement.reference_number && canLinkReference ? (
                              <Button
                                variant="link"
                                size="xs"
                                className="h-auto p-0 text-xs"
                                asChild
                              >
                                <Link to={referenceTarget}>
                                  {movement.reference_number}
                                </Link>
                              </Button>
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                          <span>{formatDate(movement.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasMore ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() =>
                  setVisibleLimit((current) => current + MOVEMENTS_PAGE_SIZE)
                }
                disabled={movementsQuery.isFetching}
              >
                تحميل المزيد
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
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
