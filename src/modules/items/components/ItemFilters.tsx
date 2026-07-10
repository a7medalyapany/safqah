import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

      <Select
        value={categoryId || "all"}
        onValueChange={(value) => onCategoryChange(value === "all" ? "" : value)}
      >
        <SelectTrigger dir="rtl" className="h-10 min-w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent dir="rtl">
          <SelectItem value="all">جميع التصنيفات</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={String(category.id)}>
              {category.name_ar}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {actions ? (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row-reverse">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
