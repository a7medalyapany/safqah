import { Barcode, ClipboardCheck, Clock, Edit3, PackageSearch, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Category, Item } from "@/modules/items/types";
import { getItemStockTone } from "@/modules/items/utils";
import {
  EmptyState,
  LoadingRows,
  TableCell,
  TableHeadCell,
} from "@/shared/components/DataTable";
import { formatEGP } from "@/shared/utils/money";

export function ItemsTable({
  items,
  categories,
  isLoading,
  onPrint,
  onEdit,
  onShowHistory,
  onAdjustStock,
  onDelete,
}: {
  items: Item[];
  categories: Category[];
  isLoading: boolean;
  onPrint: (item: Item) => void;
  onEdit: (item: Item) => void;
  onShowHistory: (item: Item) => void;
  onAdjustStock: (item: Item) => void;
  onDelete: (item: Item) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle>قائمة الأصناف</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-right">
            <thead className="bg-muted/40 text-sm text-muted-foreground">
              <tr>
                <TableHeadCell>الاسم</TableHeadCell>
                <TableHeadCell>اللون</TableHeadCell>
                <TableHeadCell>المقاس</TableHeadCell>
                <TableHeadCell>الباركود</TableHeadCell>
                <TableHeadCell>الكمية</TableHeadCell>
                <TableHeadCell>سعر الشراء</TableHeadCell>
                <TableHeadCell>سعر البيع</TableHeadCell>
                <TableHeadCell>التصنيف</TableHeadCell>
                <TableHeadCell>الإجراءات</TableHeadCell>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <LoadingRows columns={9} />
              ) : items.length === 0 ? (
                <EmptyState
                  colSpan={9}
                  icon={<PackageSearch className="size-10 text-muted-foreground" />}
                  label="لا توجد أصناف"
                />
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
                      <Badge variant="outline" className={getItemStockTone(item)}>
                        {item.current_stock}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatEGP(item.buy_price_millieme)}</TableCell>
                    <TableCell>{formatEGP(item.sell_price_millieme)}</TableCell>
                    <TableCell>
                      {getCategoryName(item.category_id, categories)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-row-reverse justify-start gap-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onPrint(item)}
                          aria-label="طباعة باركود"
                        >
                          <Barcode />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onEdit(item)}
                          aria-label="تعديل الصنف"
                        >
                          <Edit3 />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onShowHistory(item)}
                          aria-label="حركة المخزون"
                        >
                          <Clock />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onAdjustStock(item)}
                          aria-label="تسوية جرد"
                        >
                          <ClipboardCheck />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onDelete(item)}
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
  );
}

function getCategoryName(categoryId: number | null, categories: Category[]) {
  if (!categoryId) {
    return "—";
  }

  return categories.find((category) => category.id === categoryId)?.name_ar ?? "—";
}
