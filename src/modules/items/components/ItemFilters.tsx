import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { Category } from "@/modules/items/types";

export function ItemFilters({
  search,
  categoryId,
  categories,
  onSearchChange,
  onCategoryChange,
  actions,
}: {
  search: string;
  categoryId: string;
  categories: Category[];
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3 md:flex-row-reverse md:items-center">
      <div className="relative flex-1">
        <Search className="absolute inset-e-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          dir="rtl"
          className="pe-9"
          placeholder="ابحث بالاسم أو الباركود..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <select
        dir="rtl"
        className="h-10 min-w-48 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        value={categoryId}
        onChange={(event) => onCategoryChange(event.target.value)}
      >
        <option value="">جميع التصنيفات</option>
        {categories.map((category) => (
          <option key={category.id} value={String(category.id)}>
            {category.name_ar}
          </option>
        ))}
      </select>

      {actions ? (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row-reverse">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
