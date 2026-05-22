import { useDeferredValue, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import {
  BadgePlus,
  Boxes,
  CircleAlert,
  Edit3,
  PackageSearch,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemFormDialog } from "@/modules/items/ItemFormDialog";
import { DeleteConfirmDialog } from "@/modules/items/DeleteConfirmDialog";
import type { Category, Item } from "@/modules/items/types";
import { getItemStockTone } from "@/modules/items/utils";
import { formatEGP } from "@/shared/utils/money";

export default function ItemsPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const deferredSearch = useDeferredValue(search);
  const selectedCategoryId = categoryId ? Number(categoryId) : null;

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => invoke<Category[]>("list_categories"),
    staleTime: 30 * 1000,
  });

  const statsQuery = useQuery({
    queryKey: ["items-stats"],
    queryFn: () => invoke<Item[]>("list_items", { search: null, categoryId: null }),
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
                <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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

            <Button onClick={() => setIsCreateOpen(true)}>
              <BadgePlus />
              إضافة صنف جديد
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
                            <p className="text-base font-medium">لا توجد أصناف</p>
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
                            {getCategoryName(item.category_id, categoriesQuery.data)}
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

      <ItemFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

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

function TableHead({
  children,
}: {
  children: ReactNode;
}) {
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

function getCategoryName(
  categoryId: number | null,
  categories?: Category[],
) {
  if (!categoryId) {
    return "—";
  }

  return categories?.find((category) => category.id === categoryId)?.name_ar ?? "—";
}
