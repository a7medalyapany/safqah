import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Info, PlusCircle, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Category, Item } from "@/modules/items/types";
import { parseAppError } from "@/modules/items/utils";
import type { Supplier } from "@/modules/parties/types";
import type { DraftPurchaseItem, ItemPurchaseHistory, PaymentMethod, PriceSuggestion, PurchaseDetail } from "@/modules/purchases/types";
import { buildPriceSuggestions, calculateProfitMargin, formatDateOnly, formatMarginLabel, parseInteger, safeToMillieme, toMoneyInput } from "@/modules/purchases/utils";
import { invoke } from "@/shared/utils/invoke";
import { formatEGP } from "@/shared/utils/money";
import { useSessionStore } from "@/store/sessionSlice";
import { Field, FilterField, SummaryRow, TableCell, TableHead } from "./PurchasePrimitives";
import { ItemPurchaseHistoryPanel } from "./ItemPurchaseHistoryPanel";

export function PurchaseFormDialog({
  open,
  onOpenChange,
  onSavedWithPriceSuggestions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSavedWithPriceSuggestions: (suggestions: PriceSuggestion[]) => void;
}) {
  const queryClient = useQueryClient();
  const activeSession = useSessionStore((state) => state.activeSession);
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
  const [newItemValues, setNewItemValues] = useState({
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

    setSupplierId("");
    setPaymentMethod("cash");
    setNotes("");
    setTab("existing");
    setSearch("");
    setSelectedItems([]);
    setSelectedHistoryItem(null);
    setHistoryByItemId({});
    setHistoryLoadingItemId(null);
    setDiscount("");
    setPaid("");
    setNewItemValues({
      name: "",
      barcode: "",
      categoryId: "",
      qty: "1",
      buyPrice: "",
      sellPrice: "",
    });
  }, [open]);

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

  const createPurchaseMutation = useMutation({
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["purchases"] }),
        queryClient.invalidateQueries({ queryKey: ["purchases-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["items"] }),
      ]);
      toast.success("تم حفظ فاتورة الشراء بنجاح");
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

      void queryClient.invalidateQueries({ queryKey: ["items"] });
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
    selectedItems.length > 0 && !createPurchaseMutation.isPending;
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
          <DialogTitle>فاتورة شراء جديدة</DialogTitle>
          <DialogDescription>
            أدخل بيانات المورد والأصناف ثم احفظ الفاتورة.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <FilterField label="المورد (اختياري)">
              <select
                dir="rtl"
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
              >
                <option value="">بدون مورد</option>
                {(suppliersQuery.data ?? []).map((supplier) => (
                  <option key={supplier.id} value={String(supplier.id)}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="طريقة الدفع">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: "cash", label: "كاش" },
                    { value: "deferred", label: "آجل" },
                    { value: "partial", label: "جزئي" },
                  ] as const
                ).map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={
                      paymentMethod === option.value ? "default" : "outline"
                    }
                    onClick={() => setPaymentMethod(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </FilterField>
          </div>

          <FilterField label="ملاحظات">
            <textarea
              dir="rtl"
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="أضف ملاحظات إضافية (اختياري)"
            />
          </FilterField>

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
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Field
                  label="اسم الصنف"
                  value={newItemValues.name}
                  onChange={(value) =>
                    setNewItemValues((current) => ({ ...current, name: value }))
                  }
                />
                <Field
                  label="الباركود"
                  value={newItemValues.barcode}
                  onChange={(value) =>
                    setNewItemValues((current) => ({
                      ...current,
                      barcode: value,
                    }))
                  }
                />
                <FilterField label="التصنيف">
                  <select
                    dir="rtl"
                    className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={newItemValues.categoryId}
                    onChange={(event) =>
                      setNewItemValues((current) => ({
                        ...current,
                        categoryId: event.target.value,
                      }))
                    }
                  >
                    <option value="">بدون تصنيف</option>
                    {(categoriesQuery.data ?? []).map((category) => (
                      <option key={category.id} value={String(category.id)}>
                        {category.name_ar}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <Field
                  label="الكمية"
                  type="number"
                  min="1"
                  value={newItemValues.qty}
                  onChange={(value) =>
                    setNewItemValues((current) => ({ ...current, qty: value }))
                  }
                />
                <Field
                  label="سعر الشراء"
                  type="number"
                  step="0.001"
                  min="0"
                  value={newItemValues.buyPrice}
                  onChange={(value) =>
                    setNewItemValues((current) => ({
                      ...current,
                      buyPrice: value,
                    }))
                  }
                />
                <Field
                  label="سعر البيع"
                  type="number"
                  step="0.001"
                  min="0"
                  value={newItemValues.sellPrice}
                  onChange={(value) =>
                    setNewItemValues((current) => ({
                      ...current,
                      sellPrice: value,
                    }))
                  }
                />
                <div className="md:col-span-2">
                  <Button
                    type="button"
                    onClick={handleCreateItem}
                    disabled={createItemMutation.isPending}
                  >
                    <PlusCircle />
                    إضافة الصنف للفاتورة
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <TableHead>اسم الصنف</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>سعر الشراء</TableHead>
                  <TableHead>سعر البيع المقترح</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead></TableHead>
                </tr>
              </thead>
              <tbody>
                {selectedItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-sm text-muted-foreground"
                    >
                      لم يتم إضافة أصناف بعد.
                    </td>
                  </tr>
                ) : (
                  <TooltipProvider>
                    {selectedItems.map((item) => {
                      const unitCostMillieme = safeToMillieme(item.unitCost);
                      const sellPriceMillieme = item.suggestedSellPrice.trim()
                        ? safeToMillieme(item.suggestedSellPrice)
                        : item.currentSellPriceMillieme;
                      const margin = calculateProfitMargin(
                        unitCostMillieme,
                        sellPriceMillieme,
                      );

                      return (
                        <tr key={item.itemId} className="border-t">
                          <TableCell className="font-medium text-foreground">
                            <div className="flex items-center justify-between gap-2">
                              <span>{item.itemName}</span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex text-muted-foreground transition hover:text-foreground"
                                    aria-label="معلومة آخر شراء"
                                  >
                                    <Info className="size-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {item.lastPurchaseCostMillieme !== null &&
                                  item.lastPurchaseDate ? (
                                    <p>
                                      آخر شراء:{" "}
                                      {formatEGP(item.lastPurchaseCostMillieme)}{" "}
                                      — {formatDateOnly(item.lastPurchaseDate)}
                                    </p>
                                  ) : (
                                    <p>لا يوجد سجل شراء سابق لهذا الصنف.</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              value={item.qty}
                              onChange={(event) =>
                                updateItemField(
                                  item.itemId,
                                  "qty",
                                  event.target.value,
                                )
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1.5">
                              <Input
                                type="number"
                                step="0.001"
                                min={0}
                                value={item.unitCost}
                                onChange={(event) =>
                                  updateItemField(
                                    item.itemId,
                                    "unitCost",
                                    event.target.value,
                                  )
                                }
                              />

                              {item.lastPurchaseCostMillieme !== null ? (
                                unitCostMillieme >
                                item.lastPurchaseCostMillieme ? (
                                  <p className="flex items-center gap-1 text-xs text-amber-700">
                                    <AlertTriangle className="size-3.5" />
                                    السعر الجديد أعلى من آخر سعر شراء
                                  </p>
                                ) : unitCostMillieme <
                                  item.lastPurchaseCostMillieme ? (
                                  <p className="flex items-center gap-1 text-xs text-emerald-700">
                                    <CheckCircle2 className="size-3.5" />
                                    السعر الجديد أقل من آخر سعر شراء
                                  </p>
                                ) : null
                              ) : null}

                              <p
                                className={cn(
                                  "text-xs",
                                  margin === null
                                    ? "text-muted-foreground"
                                    : margin > 20
                                      ? "text-emerald-700"
                                      : margin >= 10
                                        ? "text-amber-700"
                                        : "text-red-700",
                                )}
                              >
                                هامش الربح المتوقع: {formatMarginLabel(margin)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.001"
                              min={0}
                              value={item.suggestedSellPrice}
                              onChange={(event) =>
                                updateItemField(
                                  item.itemId,
                                  "suggestedSellPrice",
                                  event.target.value,
                                )
                              }
                              placeholder="اختياري"
                            />
                          </TableCell>
                          <TableCell>
                            {formatEGP(
                              unitCostMillieme * parseInteger(item.qty),
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() =>
                                setSelectedItems((current) =>
                                  current.filter(
                                    (entry) => entry.itemId !== item.itemId,
                                  ),
                                )
                              }
                            >
                              <X />
                            </Button>
                          </TableCell>
                        </tr>
                      );
                    })}
                  </TooltipProvider>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border bg-muted/10 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <SummaryRow
                label="المجموع الفرعي"
                value={formatEGP(subtotalMillieme)}
              />
              <FilterField label="الخصم">
                <Input
                  type="number"
                  step="0.001"
                  min={0}
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                />
              </FilterField>
              <SummaryRow
                label="الإجمالي"
                value={formatEGP(totalMillieme)}
                strong
              />
              <FilterField label="المدفوع">
                <Input
                  type="number"
                  step="0.001"
                  min={0}
                  value={paid}
                  onChange={(event) => setPaid(event.target.value)}
                />
              </FilterField>
              <SummaryRow
                label="المتبقي"
                value={formatEGP(remainingMillieme)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row-reverse justify-start gap-2">
          <Button
            onClick={() => createPurchaseMutation.mutate()}
            disabled={!canSubmit}
          >
            حفظ الفاتورة
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
