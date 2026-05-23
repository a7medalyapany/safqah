import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import {
  Banknote,
  Clock3,
  Eye,
  PlusCircle,
  Printer,
  ReceiptText,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { parseAppError } from "@/modules/items/utils";
import type { Category, Item } from "@/modules/items/types";
import type { Supplier } from "@/modules/parties/types";
import { formatEGP, toMillieme } from "@/shared/utils/money";
import { useSessionStore } from "@/store/sessionSlice";

const PAGE_SIZE = 50;

type PurchaseStatus = "paid" | "deferred" | "partial";
type PaymentMethod = "cash" | "deferred" | "partial";

type PurchaseFilters = {
  dateFrom: string | null;
  dateTo: string | null;
  supplierId: number | null;
  status: string | null;
  limit: number;
  offset: number;
};

type PurchaseSummary = {
  id: number;
  invoice_number: string;
  supplier_id: number | null;
  supplier_name: string | null;
  total_millieme: number;
  paid_millieme: number;
  payment_method: string;
  status: PurchaseStatus;
  created_at: string;
};

type PurchaseStats = {
  total_count: number;
  paid_count: number;
  deferred_count: number;
  total_purchases_millieme: number;
};

type PurchaseItemDetail = {
  id: number;
  purchase_id: number;
  item_id: number;
  item_name_ar: string;
  qty: number;
  unit_cost_millieme: number;
  suggested_sell_price_millieme: number | null;
  total_millieme: number;
};

type PurchaseDetail = PurchaseSummary & {
  session_id: number | null;
  subtotal_millieme: number;
  discount_millieme: number;
  notes: string | null;
  items: PurchaseItemDetail[];
};

type DraftPurchaseItem = {
  itemId: number;
  itemName: string;
  qty: string;
  unitCost: string;
  suggestedSellPrice: string;
  currentSellPriceMillieme: number;
  isNew: boolean;
};

type PriceSuggestion = {
  itemId: number;
  itemName: string;
  currentSellPriceMillieme: number;
  suggestedSellPriceMillieme: number;
};

const statusLabels: Record<PurchaseStatus, string> = {
  paid: "مدفوع",
  deferred: "آجل",
  partial: "جزئي",
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "كاش",
  deferred: "آجل",
  partial: "جزئي",
};

export default function PurchasesPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(
    null,
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [priceSuggestions, setPriceSuggestions] = useState<PriceSuggestion[]>(
    [],
  );
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);

  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [dateFrom, dateTo, supplierId, status]);

  const statsQuery = useQuery({
    queryKey: ["purchases-stats"],
    queryFn: () => invoke<PurchaseStats>("get_purchase_stats"),
    staleTime: 30 * 1000,
  });

  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => invoke<Supplier[]>("list_suppliers", { search: null }),
    staleTime: 30 * 1000,
  });

  const purchasesQuery = useQuery({
    queryKey: ["purchases", dateFrom, dateTo, supplierId, status, visibleLimit],
    queryFn: () =>
      invoke<PurchaseSummary[]>("list_purchases", {
        filters: buildFilters({
          dateFrom,
          dateTo,
          supplierId,
          status,
          limit: visibleLimit,
          offset: 0,
        }),
      }),
    staleTime: 15 * 1000,
  });

  const detailQuery = useQuery({
    queryKey: ["purchase-detail", selectedPurchaseId],
    queryFn: () =>
      invoke<PurchaseDetail>("get_purchase_detail", {
        purchaseId: selectedPurchaseId,
      }),
    enabled: selectedPurchaseId !== null,
  });

  const stats = statsQuery.data ?? {
    total_count: 0,
    paid_count: 0,
    deferred_count: 0,
    total_purchases_millieme: 0,
  };
  const purchases = purchasesQuery.data ?? [];
  const selectedPurchase = detailQuery.data ?? null;
  const hasMore = purchases.length >= visibleLimit;

  const handleOpenPriceSuggestions = (suggestions: PriceSuggestion[]) => {
    if (suggestions.length === 0) {
      return;
    }

    setPriceSuggestions(suggestions);
    setIsPriceDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          فواتير المشتريات
        </h1>
        <p className="text-sm text-muted-foreground">
          تتبع فواتير الشراء، حالات السداد، ومتابعة الموردين من شاشة واحدة.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="إجمالي فواتير الشراء"
          value={statsQuery.isLoading ? "..." : stats.total_count}
          icon={<ReceiptText className="size-5" />}
        />
        <StatCard
          title="فواتير مدفوعة"
          value={statsQuery.isLoading ? "..." : stats.paid_count}
          icon={<Banknote className="size-5" />}
        />
        <StatCard
          title="فواتير آجلة"
          value={statsQuery.isLoading ? "..." : stats.deferred_count}
          icon={<Clock3 className="size-5" />}
        />
        <StatCard
          title="إجمالي المشتريات"
          value={
            statsQuery.isLoading
              ? "..."
              : formatEGP(stats.total_purchases_millieme)
          }
          icon={<ReceiptText className="size-5" />}
        />
      </section>

      <Card className="border-none bg-transparent p-0 shadow-none ring-0">
        <CardContent className="space-y-4 px-0">
          <div className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,1fr))]">
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button onClick={() => setIsCreateOpen(true)}>
                <PlusCircle />
                فاتورة شراء جديدة
              </Button>
            </div>
            <FilterField label="من تاريخ">
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </FilterField>
            <FilterField label="إلى تاريخ">
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </FilterField>
            <FilterField label="المورد">
              <select
                dir="rtl"
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
              >
                <option value="">جميع الموردين</option>
                {(suppliersQuery.data ?? []).map((supplier) => (
                  <option key={supplier.id} value={String(supplier.id)}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="الحالة">
              <select
                dir="rtl"
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">الكل</option>
                <option value="paid">مدفوع</option>
                <option value="deferred">آجل</option>
                <option value="partial">جزئي</option>
              </select>
            </FilterField>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle>قائمة الفواتير</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-right">
                  <thead className="bg-muted/40 text-sm text-muted-foreground">
                    <tr>
                      <TableHead>رقم الفاتورة</TableHead>
                      <TableHead>المورد</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>المدفوع</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {purchasesQuery.isLoading ? (
                      <LoadingRows columns={7} />
                    ) : purchases.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16">
                          <div className="flex flex-col items-center justify-center gap-3 text-center">
                            <ReceiptText className="size-10 text-muted-foreground" />
                            <p className="text-base font-medium">
                              لا توجد فواتير
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      purchases.map((purchase) => (
                        <tr
                          key={purchase.id}
                          className="border-t transition-colors hover:bg-muted/30"
                        >
                          <TableCell className="font-medium text-foreground">
                            {purchase.invoice_number}
                          </TableCell>
                          <TableCell>
                            {purchase.supplier_name || "بدون مورد"}
                          </TableCell>
                          <TableCell>
                            {formatEGP(purchase.total_millieme)}
                          </TableCell>
                          <TableCell>
                            {formatEGP(purchase.paid_millieme)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={purchase.status} />
                          </TableCell>
                          <TableCell>
                            {formatDate(purchase.created_at)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setSelectedPurchaseId(purchase.id)}
                              aria-label="عرض تفاصيل الفاتورة"
                            >
                              <Eye />
                            </Button>
                          </TableCell>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {hasMore ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() =>
                  setVisibleLimit((current) => current + PAGE_SIZE)
                }
                disabled={purchasesQuery.isFetching}
              >
                تحميل المزيد
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <PurchaseFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSavedWithPriceSuggestions={handleOpenPriceSuggestions}
      />

      <PurchaseDetailSheet
        open={selectedPurchaseId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPurchaseId(null);
          }
        }}
        purchase={selectedPurchase}
        isLoading={detailQuery.isLoading}
      />

      <PriceUpdateDialog
        open={isPriceDialogOpen}
        onOpenChange={setIsPriceDialogOpen}
        suggestions={priceSuggestions}
        onClear={() => setPriceSuggestions([])}
      />
    </div>
  );
}

function buildFilters(params: {
  dateFrom: string;
  dateTo: string;
  supplierId: string;
  status: string;
  limit: number;
  offset: number;
}): PurchaseFilters {
  return {
    dateFrom: params.dateFrom || null,
    dateTo: params.dateTo || null,
    supplierId: params.supplierId ? Number(params.supplierId) : null,
    status: params.status || null,
    limit: params.limit,
    offset: params.offset,
  };
}

function PurchaseFormDialog({
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
      if (appError.message_en) {
        console.error(appError.message_en);
      }
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

  const handleSelectItem = (item: Item) => {
    addOrUpdateItem({
      itemId: item.id,
      itemName: item.name_ar,
      qty: "1",
      unitCost: toMoneyInput(item.buy_price_millieme),
      suggestedSellPrice: "",
      currentSellPriceMillieme: item.sell_price_millieme,
      isNew: false,
    });
    setSearch("");
  };

  const updateItemField = (
    itemId: number,
    field: keyof Omit<
      DraftPurchaseItem,
      "itemId" | "itemName" | "currentSellPriceMillieme"
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
                  <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
                  selectedItems.map((item) => (
                    <tr key={item.itemId} className="border-t">
                      <TableCell className="font-medium text-foreground">
                        {item.itemName}
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
                          safeToMillieme(item.unitCost) *
                            parseInteger(item.qty),
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
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border bg-muted/10 p-4">
            <div className="grid gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
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

function PurchaseDetailSheet({
  open,
  onOpenChange,
  purchase,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: PurchaseDetail | null;
  isLoading: boolean;
}) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent dir="rtl">
        <SheetHeader>
          <SheetTitle>
            {purchase?.invoice_number ?? "تفاصيل الفاتورة"}
          </SheetTitle>
          <SheetDescription>
            {purchase
              ? formatDate(purchase.created_at)
              : "جارٍ تحميل بيانات الفاتورة..."}
          </SheetDescription>
        </SheetHeader>

        {isLoading || !purchase ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">المورد</p>
                <p className="text-base font-medium">
                  {purchase.supplier_name || "بدون مورد"}
                </p>
              </div>
              <StatusBadge status={purchase.status} />
            </div>

            <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm">
              <SummaryRow
                label="طريقة الدفع"
                value={
                  paymentMethodLabels[
                    purchase.payment_method as PaymentMethod
                  ] ?? purchase.payment_method
                }
              />
              <SummaryRow label="الملاحظات" value={purchase.notes || "—"} />
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-right text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <TableHead>الصنف</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>سعر الشراء</TableHead>
                    <TableHead>سعر البيع المقترح</TableHead>
                    <TableHead>الإجمالي</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <TableCell className="font-medium text-foreground">
                        {item.item_name_ar}
                      </TableCell>
                      <TableCell>{item.qty}</TableCell>
                      <TableCell>
                        {formatEGP(item.unit_cost_millieme)}
                      </TableCell>
                      <TableCell>
                        {item.suggested_sell_price_millieme
                          ? formatEGP(item.suggested_sell_price_millieme)
                          : "—"}
                      </TableCell>
                      <TableCell>{formatEGP(item.total_millieme)}</TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
              <SummaryRow
                label="المجموع الفرعي"
                value={formatEGP(purchase.subtotal_millieme)}
              />
              <SummaryRow
                label="الخصم"
                value={formatEGP(purchase.discount_millieme)}
              />
              <Separator />
              <SummaryRow
                label="الإجمالي"
                value={formatEGP(purchase.total_millieme)}
                strong
              />
              <SummaryRow
                label="المدفوع"
                value={formatEGP(purchase.paid_millieme)}
              />
              <SummaryRow
                label="المتبقي"
                value={formatEGP(
                  Math.max(purchase.total_millieme - purchase.paid_millieme, 0),
                )}
              />
            </div>

            <Button variant="outline" onClick={handlePrint}>
              <Printer />
              طباعة
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PriceUpdateDialog({
  open,
  onOpenChange,
  suggestions,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: PriceSuggestion[];
  onClear: () => void;
}) {
  const queryClient = useQueryClient();

  const updatePricesMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        suggestions.map((item) =>
          invoke("update_item", {
            id: item.itemId,
            payload: {
              sell_price_millieme: item.suggestedSellPriceMillieme,
            },
          }),
        ),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      toast.success("تم تحديث أسعار البيع بنجاح");
      onOpenChange(false);
      onClear();
    },
    onError: (error) => {
      const appError = parseAppError(error);
      toast.error(appError.message_ar);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          onClear();
        }
      }}
    >
      <DialogContent dir="rtl" className="sm:max-w-2xl">
        <DialogHeader className="text-right">
          <DialogTitle>تحديث أسعار البيع</DialogTitle>
          <DialogDescription>
            سعر البيع الحالي يختلف عن السعر المقترح لبعض الأصناف. هل ترغب في
            تحديثه؟
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {suggestions.map((item) => (
            <div
              key={item.itemId}
              className="rounded-lg border bg-muted/20 p-3"
            >
              <p className="font-medium">{item.itemName}</p>
              <p className="text-sm text-muted-foreground">
                سعر البيع الحالي {formatEGP(item.currentSellPriceMillieme)} — هل
                تريد تحديثه إلى {formatEGP(item.suggestedSellPriceMillieme)}؟
              </p>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-row-reverse justify-start gap-2">
          <Button
            onClick={() => updatePricesMutation.mutate()}
            disabled={updatePricesMutation.isPending}
          >
            تحديث الأسعار
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            تجاهل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: ReactNode;
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

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  min?: string;
  step?: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input
        type={type}
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function StatusBadge({ status }: { status: PurchaseStatus }) {
  return (
    <Badge variant="outline" className={cn(getStatusTone(status))}>
      {statusLabels[status] ?? status}
    </Badge>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        strong && "text-base font-semibold",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function LoadingRows({ columns }: { columns: number }) {
  return Array.from({ length: 6 }).map((_, index) => (
    <tr key={index} className="border-t">
      {Array.from({ length: columns }).map((__, cellIndex) => (
        <td key={cellIndex} className="px-4 py-3">
          <Skeleton className="h-5 w-full max-w-24" />
        </td>
      ))}
    </tr>
  ));
}

function TableHead({ children }: { children?: ReactNode }) {
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

function getStatusTone(status: PurchaseStatus) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (status === "deferred") {
    return "border-orange-200 bg-orange-100 text-orange-800";
  }

  return "border-yellow-200 bg-yellow-100 text-yellow-800";
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

function safeToMillieme(value: string) {
  try {
    return toMillieme(value);
  } catch {
    return 0;
  }
}

function toMoneyInput(milliemes: number) {
  const value = (milliemes / 1000).toFixed(3);
  return value.replace(/\.0+$/, "").replace(/\.$/, "");
}

function parseInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildPriceSuggestions(items: DraftPurchaseItem[]): PriceSuggestion[] {
  return items
    .map((item) => {
      const suggestedSellPriceMillieme = item.suggestedSellPrice.trim()
        ? safeToMillieme(item.suggestedSellPrice)
        : null;

      if (
        suggestedSellPriceMillieme === null ||
        suggestedSellPriceMillieme === item.currentSellPriceMillieme
      ) {
        return null;
      }

      return {
        itemId: item.itemId,
        itemName: item.itemName,
        currentSellPriceMillieme: item.currentSellPriceMillieme,
        suggestedSellPriceMillieme,
      };
    })
    .filter((item): item is PriceSuggestion => Boolean(item));
}
