import type { RefObject } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Category, Item } from "@/modules/items/types";
import {
  CategoryTab,
  LoadingItemGrid,
  TableCell,
  TableHead,
} from "@/modules/pos/components/PosControls";
import { getStockBadgeTone } from "@/modules/pos/utils";
import { formatEGP } from "@/shared/utils/money";

export function CatalogPanel({
  searchInputRef,
  search,
  onSearchChange,
  categories,
  selectedCategoryId,
  onSelectCategory,
  items,
  isLoading,
  onItemClick,
  onItemDoubleClick,
}: {
  searchInputRef: RefObject<HTMLInputElement | null>;
  search: string;
  onSearchChange: (value: string) => void;
  categories: Category[];
  selectedCategoryId: number | null;
  onSelectCategory: (categoryId: number | null) => void;
  items: Item[];
  isLoading: boolean;
  onItemClick: (item: Item) => void;
  onItemDoubleClick: (item: Item) => void;
}) {
  return (
    <Card className="flex min-h-[70vh] flex-1 flex-col lg:h-full lg:min-h-0 lg:basis-[45%]">
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-right text-2xl">نقطة البيع</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute inset-e-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              dir="rtl"
              className="h-14 pe-12 text-lg"
              placeholder="ابحث بالاسم أو الباركود"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <CategoryTab
              active={selectedCategoryId === null}
              onClick={() => onSelectCategory(null)}
            >
              الكل
            </CategoryTab>
            {categories.map((category) => (
              <CategoryTab
                key={category.id}
                active={selectedCategoryId === category.id}
                onClick={() => onSelectCategory(category.id)}
              >
                {category.name_ar}
              </CategoryTab>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border">
          <div className="h-full overflow-y-auto">
            {isLoading ? (
              <LoadingItemGrid />
            ) : items.length === 0 ? (
              <div className="flex h-full min-h-60 items-center justify-center px-6 text-center text-muted-foreground">
                لا توجد أصناف مطابقة
              </div>
            ) : (
              <table className="w-full border-separate border-spacing-0 text-right text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted/80 backdrop-blur [&>th]:border-b [&>th]:border-border">
                    <TableHead className="w-auto">الصنف</TableHead>
                    <TableHead className="hidden w-32 sm:table-cell">
                      الباركود
                    </TableHead>
                    <TableHead className="w-24 text-center">المخزون</TableHead>
                    <TableHead className="w-28 text-center">السعر</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="cursor-pointer select-none transition-colors hover:bg-muted/40 [&>td]:border-b [&>td]:border-border/60"
                      onClick={() => onItemClick(item)}
                      onDoubleClick={() => onItemDoubleClick(item)}
                    >
                      <TableCell className="font-medium">
                        {item.name_ar}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                        {item.barcode || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={getStockBadgeTone(item.current_stock)}
                        >
                          {item.current_stock}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold tabular-nums whitespace-nowrap">
                        {formatEGP(item.sell_price_millieme)}
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
