import type { RefObject } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Category, Item } from "@/modules/items/types";
import { CategoryTab, LoadingItemGrid } from "@/modules/pos/components/PosControls";
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
    <Card className="flex min-h-[70vh] flex-1 flex-col lg:h-full lg:min-h-0 lg:basis-[60%]">
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

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <LoadingItemGrid />
          ) : items.length === 0 ? (
            <div className="flex h-full min-h-60 items-center justify-center rounded-2xl border border-dashed text-center text-muted-foreground">
              لا توجد أصناف مطابقة
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="rounded-2xl border bg-card p-4 text-right transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onItemClick(item)}
                  onDoubleClick={() => onItemDoubleClick(item)}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <Badge
                      variant="outline"
                      className={getStockBadgeTone(item.current_stock)}
                    >
                      مخزون: {item.current_stock}
                    </Badge>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.name_ar}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.barcode || "بدون باركود"}
                      </p>
                    </div>
                  </div>
                  <p className="text-lg font-semibold">
                    {formatEGP(item.sell_price_millieme)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
