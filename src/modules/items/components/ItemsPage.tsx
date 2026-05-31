import { BadgePlus, FolderTree } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { Button } from "@/components/ui/button";
import { ItemFormDialog } from "@/modules/items/ItemFormDialog";
import { DeleteConfirmDialog } from "@/modules/items/DeleteConfirmDialog";
import { PrintBarcodeDialog } from "@/modules/items/PrintBarcodeDialog";
import { StockAdjustmentDialog } from "@/modules/items/StockAdjustmentDialog";
import { CategoryManagerDialog } from "@/modules/items/categories";
import { ItemFilters } from "@/modules/items/components/ItemFilters";
import { ItemStatsGrid } from "@/modules/items/components/ItemStatsGrid";
import { ItemsHeader } from "@/modules/items/components/ItemsHeader";
import { ItemsTable } from "@/modules/items/components/ItemsTable";
import { StockMovementsSheet } from "@/modules/items/components/StockMovementsSheet";
import {
  useItemCategories,
  useItems,
  useItemStats,
} from "@/modules/items/hooks";
import type { Item } from "@/modules/items/types";
import { useBarcodeScanner } from "@/shared/hooks/useBarcodeScanner";

export default function ItemsPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [historyItem, setHistoryItem] = useState<Item | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<Item | null>(null);
  const [printingItem, setPrintingItem] = useState<Item | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const isScannerEnabled =
    !isCreateOpen &&
    !editingItem &&
    !deletingItem &&
    !isCategoryManagerOpen &&
    !historyItem &&
    !adjustingItem &&
    !printingItem;

  const deferredSearch = useDeferredValue(search);
  const selectedCategoryId = categoryId ? Number(categoryId) : null;

  useBarcodeScanner((barcode) => {
    setSearch(barcode);
  }, isScannerEnabled);

  const categoriesQuery = useItemCategories();
  const statsQuery = useItemStats();
  const itemsQuery = useItems(deferredSearch, selectedCategoryId);

  const statsItems = statsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
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
      <ItemsHeader />

      <ItemStatsGrid stats={stats} />

      <section className="space-y-4">
        <div className="flex flex-col-reverse gap-3 rounded-2xl border bg-card p-4 lg:flex-row-reverse lg:items-center lg:justify-between">
          <ItemFilters
            search={search}
            categoryId={categoryId}
            categories={categories}
            onSearchChange={setSearch}
            onCategoryChange={setCategoryId}
            actions={
              <>
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
              </>
            }
          />
        </div>

        <ItemsTable
          items={items}
          categories={categories}
          isLoading={isLoading}
          onPrint={setPrintingItem}
          onEdit={setEditingItem}
          onShowHistory={setHistoryItem}
          onAdjustStock={setAdjustingItem}
          onDelete={setDeletingItem}
        />
      </section>

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

      <PrintBarcodeDialog
        item={printingItem}
        open={Boolean(printingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setPrintingItem(null);
          }
        }}
        onEditItem={() => {
          if (printingItem) {
            setEditingItem(printingItem);
          }
        }}
      />
    </div>
  );
}
