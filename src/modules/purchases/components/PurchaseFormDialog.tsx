import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Category, Item } from "@/modules/items/types";
import { parseAppError } from "@/modules/items/utils";
import type { Supplier } from "@/modules/parties/types";
import type { DraftPurchaseItem, ItemPurchaseHistory, PaymentMethod, PriceSuggestion, PurchaseDetail } from "@/modules/purchases/types";
import { buildPriceSuggestions, parseInteger, safeToMillieme, toMoneyInput } from "@/modules/purchases/utils";
import { useInvalidate } from "@/shared/hooks/useInvalidate";
import { invoke } from "@/shared/utils/invoke";
import { useSessionStore } from "@/store/sessionSlice";
import { ItemPurchaseHistoryPanel } from "./ItemPurchaseHistoryPanel";
import { NewItemForm, type NewItemDraft } from "./NewItemForm";
import { PurchaseHeaderFields } from "./PurchaseHeaderFields";
import { PurchaseSummaryPanel } from "./PurchaseSummaryPanel";
import { SelectedPurchaseItemsTable } from "./SelectedPurchaseItemsTable";

export function PurchaseFormDialog({
  open,
  onOpenChange,
  onSavedWithPriceSuggestions,
  purchaseToEdit = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSavedWithPriceSuggestions: (suggestions: PriceSuggestion[]) => void;
  purchaseToEdit?: PurchaseDetail | null;
}) {
  const invalidate = useInvalidate();
  const activeSession = useSessionStore((state) => state.activeSession);
  const isEditMode = purchaseToEdit !== null;
  const [supplierId, setSupplierId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<DraftPurchaseItem[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<Item | null>(
    null,
  );
  const [historyByItemId, setHistoryByItemId] = useState<
    Record<number, ItemPurchaseHistory>
  >({});
  const [historyLoadingItemId, setHistoryLoadingItemId] = useState<
    number | null
  >(null);
  const [discount, setDiscount] = useState("");
  const [paid, setPaid] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [newItemValues, setNewItemValues] = useState<NewItemDraft>({
    name: "",
    barcode: "",
    categoryId: "",
    qty: "1",
    buyPrice: "",
    sellPrice: "",
  });

  const deferredSearch = useDeferredValue(search);
  const pendingSuggestionsRef = useRef<PriceSuggestion[]>([]);
  const historyRequestIdRef = useRef(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTab("existing");
    setSearch("");
    setSelectedHistoryItem(null);
    setHistoryByItemId({});
    setHistoryLoadingItemId(null);
    setNewItemValues({
      name: "",
      barcode: "",
      categoryId: "",
      qty: "1",
      buyPrice: "",
      sellPrice: "",
    });

    if (purchaseToEdit) {
      setSupplierId(
        purchaseToEdit.supplier_id !== null
          ? String(purchaseToEdit.supplier_id)
          : "",
      );
      setPaymentMethod(purchaseToEdit.payment_method as PaymentMethod);
      setNotes(purchaseToEdit.notes ?? "");
      setSelectedItems(
        purchaseToEdit.items.map((item) => ({
          itemId: item.item_id,
          itemName: item.item_name_ar,
          qty: String(item.qty),
          unitCost: toMoneyInput(item.unit_cost_millieme),
          suggestedSellPrice:
            item.suggested_sell_price_millieme !== null
              ? toMoneyInput(item.suggested_sell_price_millieme)
              : "",
          currentSellPriceMillieme: item.suggested_sell_price_millieme ?? 0,
          lastPurchaseCostMillieme: null,
          lastPurchaseDate: null,
          isNew: false,
        })),
      );
      setDiscount(
        purchaseToEdit.discount_millieme
          ? toMoneyInput(purchaseToEdit.discount_millieme)
          : "",
      );
      setPaid(toMoneyInput(purchaseToEdit.paid_millieme));
      setInvoiceDate(purchaseToEdit.created_at.slice(0, 10));
      return;
    }

    setSupplierId("");
    setPaymentMethod("cash");
    setNotes("");
    setSelectedItems([]);
    setDiscount("");
    setPaid("");
    setInvoiceDate("");
  }, [open, purchaseToEdit]);

  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => invoke<Supplier[]>("list_suppliers", { search: null }),
    staleTime: 30 * 1000,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => invoke<Category[]>("list_categories"),
    staleTime: 30 * 1000,
  });

  const itemsQuery = useQuery({
    queryKey: ["purchase-items", deferredSearch],
    queryFn: () =>
      invoke<Item[]>("list_items", {
        search: deferredSearch.trim() || null,
        categoryId: null,
      }),
    enabled: deferredSearch.trim().length > 0,
    staleTime: 30 * 1000,
  });

  const subtotalMillieme = useMemo(
    () =>
      selectedItems.reduce(
        (total, item) =>
          total + safeToMillieme(item.unitCost) * parseInteger(item.qty),
        0,
      ),
    [selectedItems],
  );

  const discountMillieme = safeToMillieme(discount);
  const totalMillieme = Math.max(subtotalMillieme - discountMillieme, 0);
  const paidMillieme = safeToMillieme(paid);
  const remainingMillieme = Math.max(totalMillieme - paidMillieme, 0);

  useEffect(() => {
    if (paymentMethod === "deferred") {
      setPaid("0");
      return;
    }

    if (paymentMethod === "cash" && totalMillieme > 0 && paidMillieme === 0) {
      setPaid(toMoneyInput(totalMillieme));
    }
  }, [paidMillieme, paymentMethod, totalMillieme]);

  const savePurchaseMutation = useMutation({
    mutationFn: async () => {
      if (selectedItems.length === 0) {
        throw new Error("أضف صنفًا واحدًا على الأقل");
      }

      const itemsPayload = selectedItems.map((item) => {
        const qtyValue = parseInteger(item.qty);
        const unitCostMillieme = safeToMillieme(item.unitCost);
        const suggestedSellPriceMillieme = item.suggestedSellPrice.trim()
          ? safeToMillieme(item.suggestedSellPrice)
          : null;

        if (qtyValue <= 0 || unitCostMillieme < 0) {
          throw new Error("بيانات الأصناف غير صحيحة");
        }

        return {
          itemId: item.itemId,
          qty: qtyValue,
          unitCostMillieme,
          suggestedSellPriceMillieme,
        };
      });

      const suggestions = buildPriceSuggestions(selectedItems);
      pendingSuggestionsRef.current = suggestions;

      if (purchaseToEdit) {
        return invoke<PurchaseDetail>("update_purchase_invoice", {
          payload: {
            purchaseId: purchaseToEdit.id,
            supplierId: supplierId ? Number(supplierId) : null,
            items: itemsPayload,
            globalDiscountMillieme: discountMillieme,
            paymentMethod,
            paidMillieme,
            notes: notes.trim() || null,
            invoiceDate: invoiceDate || null,
          },
        });
      }

      return invoke<PurchaseDetail>("create_purchase_invoice", {
        payload: {
          supplierId: supplierId ? Number(supplierId) : null,
          sessionId: activeSession?.id ?? null,
          items: itemsPayload,
          globalDiscountMillieme: discountMillieme,
          paymentMethod,
          paidMillieme,
          notes: notes.trim() || null,
        },
      });
    },
    onSuccess: async () => {
      await invalidate(
        ["purchases"],
        ["purchases-stats"],
        ["items"],
        ["suppliers"],
        ...(purchaseToEdit
          ? [["purchase-detail", purchaseToEdit.id]]
          : []),
      );
      toast.success(
        purchaseToEdit
          ? "تم تحديث فاتورة الشراء بنجاح"
          : "تم حفظ فاتورة الشراء بنجاح",
      );
      onOpenChange(false);
      onSavedWithPriceSuggestions(pendingSuggestionsRef.current);
      pendingSuggestionsRef.current = [];
    },
    onError: (error) => {
      const appError = parseAppError(error);
      toast.error(appError.message_ar);
      console.error(appError);
    },
  });

  const createItemMutation = useMutation({
    mutationFn: () =>
      invoke<Item>("create_item", {
        payload: {
          name_ar: newItemValues.name.trim(),
          barcode: newItemValues.barcode.trim() || null,
          category_id: newItemValues.categoryId
            ? Number(newItemValues.categoryId)
            : null,
          buy_price_millieme: safeToMillieme(newItemValues.buyPrice),
          sell_price_millieme: safeToMillieme(newItemValues.sellPrice),
          current_stock: 0,
          min_stock: 0,
          unit: "قطعة",
          name_en: null,
          color: null,
          size: null,
          supplier_id: null,
          image_path: null,
        },
      }),
    onSuccess: (item) => {
      const qtyValue = parseInteger(newItemValues.qty);
      if (qtyValue <= 0) {
        toast.error("كمية الصنف غير صحيحة");
        return;
      }

      addOrUpdateItem({
        itemId: item.id,
        itemName: item.name_ar,
        qty: String(qtyValue),
        unitCost:
          newItemValues.buyPrice || toMoneyInput(item.buy_price_millieme),
        suggestedSellPrice:
          newItemValues.sellPrice || toMoneyInput(item.sell_price_millieme),
        currentSellPriceMillieme: item.sell_price_millieme,
        lastPurchaseCostMillieme: null,
        lastPurchaseDate: null,
        isNew: true,
      });

      setNewItemValues({
        name: "",
        barcode: "",
        categoryId: "",
        qty: "1",
        buyPrice: "",
        sellPrice: "",
      });

      void invalidate(["items"]);
    },
    onError: (error) => {
      const appError = parseAppError(error);
      toast.error(appError.message_ar);
    },
  });

  const addOrUpdateItem = (item: DraftPurchaseItem) => {
    setSelectedItems((current) => {
      const existing = current.find((entry) => entry.itemId === item.itemId);
      if (!existing) {
        return [...current, item];
      }

      const updatedQty = parseInteger(existing.qty) + parseInteger(item.qty);
      return current.map((entry) =>
        entry.itemId === item.itemId
          ? { ...entry, qty: String(Math.max(updatedQty, 1)) }
          : entry,
      );
    });
  };

  const handleSelectItem = async (item: Item) => {
    const requestId = historyRequestIdRef.current + 1;
    historyRequestIdRef.current = requestId;

    setSelectedHistoryItem(item);
    setHistoryLoadingItemId(item.id);
    setSearch("");

    try {
      const history = await invoke<ItemPurchaseHistory>(
        "get_item_purchase_history",
        {
          itemId: item.id,
        },
      );

      if (historyRequestIdRef.current !== requestId) {
        return;
      }

      setHistoryByItemId((current) => ({
        ...current,
        [item.id]: history,
      }));

      addOrUpdateItem({
        itemId: item.id,
        itemName: item.name_ar,
        qty: String(Math.max(history.last_purchase_qty ?? 1, 1)),
        unitCost: toMoneyInput(
          history.last_purchase_cost_millieme ??
            history.current_buy_price_millieme,
        ),
        suggestedSellPrice: toMoneyInput(history.current_sell_price_millieme),
        currentSellPriceMillieme: history.current_sell_price_millieme,
        lastPurchaseCostMillieme: history.last_purchase_cost_millieme,
        lastPurchaseDate: history.last_purchase_date,
        isNew: false,
      });
    } catch (error) {
      const appError = parseAppError(error);
      toast.error(appError.message_ar);

      if (historyRequestIdRef.current !== requestId) {
        return;
      }

      addOrUpdateItem({
        itemId: item.id,
        itemName: item.name_ar,
        qty: "1",
        unitCost: toMoneyInput(item.buy_price_millieme),
        suggestedSellPrice: toMoneyInput(item.sell_price_millieme),
        currentSellPriceMillieme: item.sell_price_millieme,
        lastPurchaseCostMillieme: null,
        lastPurchaseDate: null,
        isNew: false,
      });
    } finally {
      if (historyRequestIdRef.current === requestId) {
        setHistoryLoadingItemId(null);
      }
    }
  };

  const updateItemField = (
    itemId: number,
    field: keyof Omit<
      DraftPurchaseItem,
      | "itemId"
      | "itemName"
      | "currentSellPriceMillieme"
      | "lastPurchaseCostMillieme"
      | "lastPurchaseDate"
      | "isNew"
    >,
    value: string,
  ) => {
    setSelectedItems((current) =>
      current.map((item) =>
        item.itemId === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  };

  const handleCreateItem = () => {
    if (!newItemValues.name.trim()) {
      toast.error("اسم الصنف مطلوب");
      return;
    }

    if (!newItemValues.buyPrice.trim() || !newItemValues.sellPrice.trim()) {
      toast.error("يجب إدخال سعر الشراء وسعر البيع");
      return;
    }

    createItemMutation.mutate();
  };

  const canSubmit =
    selectedItems.length > 0 && !savePurchaseMutation.isPending;
  const selectedItemHistory = selectedHistoryItem
    ? (historyByItemId[selectedHistoryItem.id] ?? null)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"
      >
        <DialogHeader className="text-right">
          <DialogTitle>
            {isEditMode
              ? `تعديل فاتورة الشراء ${purchaseToEdit?.invoice_number ?? ""}`.trim()
              : "فاتورة شراء جديدة"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "عدّل بيانات المورد والأصناف ثم احفظ التغييرات."
              : "أدخل بيانات المورد والأصناف ثم احفظ الفاتورة."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <PurchaseHeaderFields
            supplierId={supplierId}
            onSupplierIdChange={setSupplierId}
            suppliers={suppliersQuery.data ?? []}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            isEditMode={isEditMode}
            invoiceDate={invoiceDate}
            onInvoiceDateChange={setInvoiceDate}
            notes={notes}
            onNotesChange={setNotes}
          />

          <div className="rounded-xl border bg-muted/10 p-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={tab === "existing" ? "default" : "outline"}
                onClick={() => setTab("existing")}
              >
                الأصناف الموجودة
              </Button>
              <Button
                type="button"
                variant={tab === "new" ? "default" : "outline"}
                onClick={() => setTab("new")}
              >
                صنف جديد
              </Button>
            </div>

            {tab === "existing" ? (
              <div className="mt-4 space-y-3">
                <div className="relative">
                  <Search className="absolute inset-e-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    dir="rtl"
                    className="pe-9"
                    placeholder="ابحث بالاسم أو الباركود..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                {deferredSearch.trim().length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    اكتب اسم الصنف أو الباركود للبحث.
                  </div>
                ) : itemsQuery.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (itemsQuery.data ?? []).length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    لا توجد نتائج مطابقة.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(itemsQuery.data ?? []).map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-right text-sm transition hover:bg-muted"
                        onClick={() => handleSelectItem(item)}
                      >
                        <span className="truncate font-medium">
                          {item.name_ar}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.barcode || "بدون باركود"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedHistoryItem ? (
                  <ItemPurchaseHistoryPanel
                    isLoading={historyLoadingItemId === selectedHistoryItem.id}
                    history={selectedItemHistory}
                    fallbackItemName={selectedHistoryItem.name_ar}
                  />
                ) : null}
              </div>
            ) : (
              <NewItemForm
                values={newItemValues}
                onChange={setNewItemValues}
                categories={categoriesQuery.data ?? []}
                onSubmit={handleCreateItem}
                isSubmitting={createItemMutation.isPending}
              />
            )}
          </div>

          <SelectedPurchaseItemsTable
            items={selectedItems}
            onUpdateField={updateItemField}
            onRemove={(itemId) =>
              setSelectedItems((current) =>
                current.filter((entry) => entry.itemId !== itemId),
              )
            }
          />

          <PurchaseSummaryPanel
            subtotalMillieme={subtotalMillieme}
            discount={discount}
            onDiscountChange={setDiscount}
            totalMillieme={totalMillieme}
            paid={paid}
            onPaidChange={setPaid}
            remainingMillieme={remainingMillieme}
          />
        </div>

        <DialogFooter className="flex-row-reverse justify-start gap-2 bg-transparent p-0 pt-2">
          <Button
            onClick={() => savePurchaseMutation.mutate()}
            disabled={!canSubmit}
          >
            {isEditMode ? "حفظ التغييرات" : "حفظ الفاتورة"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
