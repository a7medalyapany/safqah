import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Search, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { parseAppError } from "@/modules/items/utils";
import { InvoiceSuccessDialog, type SaleInvoiceSuccess } from "@/modules/pos/InvoiceSuccessDialog";
import type { Category, Item } from "@/modules/items/types";
import type { Customer } from "@/modules/parties/types";
import { useBarcodeScanner } from "@/shared/hooks/useBarcodeScanner";
import { formatEGP, toMillieme } from "@/shared/utils/money";
import { type CartItem, useCartStore } from "@/store/cartSlice";
import { useSessionStore } from "@/store/sessionSlice";

type PaymentMethod = "cash" | "card" | "deferred" | "split";

type CreateSaleInvoicePayload = {
  sessionId: number;
  customerId: number | null;
  paymentMethod: PaymentMethod;
  globalDiscountMillieme: number;
  paidCashMillieme: number;
  paidCardMillieme: number;
  notes: string | null;
  items: Array<{
    itemId: number;
    qty: number;
    unitPriceMillieme: number;
    discountMillieme: number;
  }>;
};

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debouncedValue;
}

function moneyToInput(milliemes: number) {
  const value = (milliemes / 1000).toFixed(3);
  return value.replace(/\.?0+$/, "");
}

function getStockBadgeTone(stock: number) {
  if (stock <= 0) {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }

  if (stock <= 5) {
    return "border-amber-200 bg-amber-100 text-amber-800";
  }

  return "border-emerald-200 bg-emerald-100 text-emerald-800";
}

function buildSalePayload(params: {
  sessionId: number;
  customerId: number | null;
  paymentMethod: PaymentMethod;
  globalDiscountMillieme: number;
  paidCashMillieme: number;
  paidCardMillieme: number;
  notes: string;
  items: CartItem[];
}): CreateSaleInvoicePayload {
  return {
    sessionId: params.sessionId,
    customerId: params.customerId,
    paymentMethod: params.paymentMethod,
    globalDiscountMillieme: params.globalDiscountMillieme,
    paidCashMillieme: params.paidCashMillieme,
    paidCardMillieme: params.paidCardMillieme,
    notes: params.notes.trim() || null,
    items: params.items.map((item) => ({
      itemId: item.itemId,
      qty: item.qty,
      unitPriceMillieme: item.unitPriceMillieme,
      discountMillieme: item.discountMillieme,
    })),
  };
}

export default function PosPage() {
  const queryClient = useQueryClient();
  const activeSession = useSessionStore((state) => state.activeSession);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const itemClickTimeoutRef = useRef<number | null>(null);

  const cartItems = useCartStore((state) => state.items);
  const customerId = useCartStore((state) => state.customerId);
  const customerName = useCartStore((state) => state.customerName);
  const globalDiscountMillieme = useCartStore((state) => state.globalDiscountMillieme);
  const paymentMethod = useCartStore((state) => state.paymentMethod);
  const paidCashMillieme = useCartStore((state) => state.paidCashMillieme);
  const paidCardMillieme = useCartStore((state) => state.paidCardMillieme);
  const notes = useCartStore((state) => state.notes);
  const subtotalMillieme = useCartStore((state) => state.subtotalMillieme());
  const totalDiscountMillieme = useCartStore((state) => state.totalDiscountMillieme());
  const totalMillieme = useCartStore((state) => state.totalMillieme());
  const changeMillieme = useCartStore((state) => state.changeMillieme());

  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQty = useCartStore((state) => state.updateQty);
  const updateLineDiscount = useCartStore((state) => state.updateLineDiscount);
  const setGlobalDiscount = useCartStore((state) => state.setGlobalDiscount);
  const setCustomer = useCartStore((state) => state.setCustomer);
  const clearCustomer = useCartStore((state) => state.clearCustomer);
  const setPaymentMethod = useCartStore((state) => state.setPaymentMethod);
  const setPaidCashAmount = useCartStore((state) => state.setPaidCashAmount);
  const setPaidCardAmount = useCartStore((state) => state.setPaidCardAmount);
  const setNotes = useCartStore((state) => state.setNotes);
  const clearCart = useCartStore((state) => state.clearCart);

  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [successInvoice, setSuccessInvoice] = useState<SaleInvoiceSuccess | null>(null);

  const debouncedSearch = useDebouncedValue(search, 150);
  const debouncedCustomerSearch = useDebouncedValue(customerSearch, 150);

  const focusSearchInput = () => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  };

  useEffect(() => {
    focusSearchInput();
  }, []);

  useEffect(() => {
    return () => {
      if (itemClickTimeoutRef.current !== null) {
        window.clearTimeout(itemClickTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (paymentMethod === "cash" && paidCashMillieme === 0 && totalMillieme > 0) {
      setPaidCashAmount(totalMillieme);
    }
  }, [paidCashMillieme, paymentMethod, setPaidCashAmount, totalMillieme]);

  useEffect(() => {
    if (!customerId) {
      setSelectedCustomer(null);
      setCustomerSearch("");
    }
  }, [customerId]);

  useBarcodeScanner(
    (barcode) => {
      setSearch(barcode);
      focusSearchInput();
    },
    !successInvoice,
  );

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => invoke<Category[]>("list_categories"),
    staleTime: 5 * 60 * 1000,
  });

  const itemsQuery = useQuery({
    queryKey: ["pos-items", debouncedSearch, selectedCategoryId],
    queryFn: () =>
      invoke<Item[]>("search_items", {
        query: debouncedSearch.trim() || null,
        categoryId: selectedCategoryId,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const customersQuery = useQuery({
    queryKey: ["customers", debouncedCustomerSearch],
    queryFn: () =>
      invoke<Customer[]>("list_customers", {
        search: debouncedCustomerSearch.trim() || null,
      }),
    enabled: debouncedCustomerSearch.trim().length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const createSaleMutation = useMutation({
    mutationFn: (payload: CreateSaleInvoicePayload) =>
      invoke<SaleInvoiceSuccess>("create_sale_invoice", { payload }),
    onSuccess: async (invoice) => {
      setSuccessInvoice(invoice);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pos-items"] }),
        queryClient.invalidateQueries({ queryKey: ["items"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
      ]);
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

  const items = itemsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const customerResults = customersQuery.data ?? [];
  const selectedCustomerBalanceMillieme = selectedCustomer?.balance_millieme ?? 0;
  const deferredPaidNowMillieme =
    paymentMethod === "deferred" ? paidCashMillieme + paidCardMillieme : 0;
  const deferredRemainingMillieme =
    paymentMethod === "deferred"
      ? Math.max(totalMillieme - deferredPaidNowMillieme, 0)
      : 0;
  const projectedCustomerBalanceMillieme =
    paymentMethod === "deferred" && selectedCustomer
      ? selectedCustomerBalanceMillieme + deferredRemainingMillieme
      : null;

  const isCartEmpty = cartItems.length === 0;
  const requiresCustomer = paymentMethod === "deferred";
  const isSubmitDisabled =
    isCartEmpty ||
    createSaleMutation.isPending ||
    (requiresCustomer && customerId === null);

  const paymentMethodLabel = useMemo(
    () =>
      ({
        cash: "كاش",
        card: "فيزا",
        deferred: "آجل",
        split: "دفع مختلط",
      }) satisfies Record<PaymentMethod, string>,
    [],
  );

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomer(customer.id, customer.name);
    setCustomerSearch(customer.name);
  };

  const handleClearCustomer = () => {
    clearCustomer();
    setSelectedCustomer(null);
    setCustomerSearch("");
  };

  const handleAddItem = (item: Item) => {
    addItem(item);
    focusSearchInput();
  };

  const handleItemCardClick = (item: Item) => {
    if (itemClickTimeoutRef.current !== null) {
      window.clearTimeout(itemClickTimeoutRef.current);
    }

    itemClickTimeoutRef.current = window.setTimeout(() => {
      handleAddItem(item);
      itemClickTimeoutRef.current = null;
    }, 180);
  };

  const handleItemCardDoubleClick = (item: Item) => {
    if (itemClickTimeoutRef.current !== null) {
      window.clearTimeout(itemClickTimeoutRef.current);
      itemClickTimeoutRef.current = null;
    }

    const maxDiscountMillieme = Math.max(
      item.sell_price_millieme - item.buy_price_millieme,
      0,
    );

    toast(
      `سعر التكلفة: ${formatEGP(item.buy_price_millieme)} | أقصى خصم قبل التكلفة: ${formatEGP(maxDiscountMillieme)}`,
    );
  };

  const handleClearInvoice = () => {
    if (!window.confirm("هل تريد مسح الفاتورة الحالية؟")) {
      return;
    }

    if (itemClickTimeoutRef.current !== null) {
      window.clearTimeout(itemClickTimeoutRef.current);
      itemClickTimeoutRef.current = null;
    }

    clearCart();
    setSelectedCustomer(null);
    setCustomerSearch("");
    setSearch("");
    focusSearchInput();
  };

  const handleNewInvoice = () => {
    if (itemClickTimeoutRef.current !== null) {
      window.clearTimeout(itemClickTimeoutRef.current);
      itemClickTimeoutRef.current = null;
    }

    clearCart();
    setSelectedCustomer(null);
    setCustomerSearch("");
    setSearch("");
    setSuccessInvoice(null);
    focusSearchInput();
  };

  const handleSubmitSale = async () => {
    if (!activeSession) {
      toast.error("لا توجد وردية مفتوحة");
      return;
    }

    if (paymentMethod === "deferred" && customerId === null) {
      toast.error("اختيار العميل مطلوب للبيع الآجل");
      return;
    }

    if (paymentMethod === "cash" && paidCashMillieme < totalMillieme) {
      toast.error("المبلغ المدفوع أقل من إجمالي الفاتورة");
      return;
    }

    if (paymentMethod === "card" && paidCardMillieme !== totalMillieme) {
      toast.error("مبلغ الفيزا يجب أن يساوي إجمالي الفاتورة");
      return;
    }

    if (paymentMethod === "deferred" && paidCashMillieme + paidCardMillieme > totalMillieme) {
      toast.error("المبلغ المدفوع أكبر من إجمالي الفاتورة");
      return;
    }

    if (
      paymentMethod === "split" &&
      paidCashMillieme + paidCardMillieme !== totalMillieme
    ) {
      toast.error("يجب أن يساوي الدفع المختلط إجمالي الفاتورة");
      return;
    }

    const payload = buildSalePayload({
      sessionId: activeSession.id,
      customerId,
      paymentMethod,
      globalDiscountMillieme,
      paidCashMillieme,
      paidCardMillieme,
      notes,
      items: cartItems,
    });

    await createSaleMutation.mutateAsync(payload);
  };

  return (
    <>
      <div className="min-h-[calc(100vh-81px)] p-4 lg:p-6">
        <div className="flex h-full flex-col gap-4 lg:flex-row-reverse">
          <Card className="flex min-h-[70vh] flex-1 flex-col lg:basis-[60%]">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-right text-2xl">نقطة البيع</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4 p-4">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute end-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    dir="rtl"
                    className="h-14 pe-12 text-lg"
                    placeholder="ابحث بالاسم أو الباركود"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <CategoryTab
                    active={selectedCategoryId === null}
                    onClick={() => setSelectedCategoryId(null)}
                  >
                    الكل
                  </CategoryTab>
                  {categories.map((category) => (
                    <CategoryTab
                      key={category.id}
                      active={selectedCategoryId === category.id}
                      onClick={() => setSelectedCategoryId(category.id)}
                    >
                      {category.name_ar}
                    </CategoryTab>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {itemsQuery.isLoading ? (
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
                        onClick={() => handleItemCardClick(item)}
                        onDoubleClick={() => handleItemCardDoubleClick(item)}
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <Badge variant="outline" className={getStockBadgeTone(item.current_stock)}>
                            مخزون: {item.current_stock}
                          </Badge>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{item.name_ar}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.barcode || "بدون باركود"}
                            </p>
                          </div>
                        </div>
                        <p className="text-lg font-semibold">{formatEGP(item.sell_price_millieme)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="flex min-h-[70vh] flex-col lg:basis-[40%]">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-right text-xl">الفاتورة الحالية</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4 p-4">
              <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border">
                <div className="h-full overflow-auto">
                  {cartItems.length === 0 ? (
                    <div className="flex h-full min-h-64 items-center justify-center px-6 text-center text-muted-foreground">
                      لا توجد أصناف — ابدأ بإضافة أصناف
                    </div>
                  ) : (
                    <table className="min-w-full text-right">
                      <thead className="sticky top-0 bg-muted/60 text-sm text-muted-foreground">
                        <tr>
                          <TableHead>الصنف</TableHead>
                          <TableHead>الكمية</TableHead>
                          <TableHead>السعر</TableHead>
                          <TableHead>الخصم</TableHead>
                          <TableHead>الإجمالي</TableHead>
                          <TableHead>×</TableHead>
                        </tr>
                      </thead>
                      <tbody>
                        {cartItems.map((item) => (
                          <tr key={item.itemId} className="border-t align-top">
                            <TableCell className="font-medium">{item.nameAr}</TableCell>
                            <TableCell>
                              <Input
                                dir="rtl"
                                type="number"
                                min={1}
                                className="w-20 text-center"
                                value={String(item.qty)}
                                onChange={(event) =>
                                  updateQty(item.itemId, Number(event.target.value) || 0)
                                }
                              />
                            </TableCell>
                            <TableCell>{formatEGP(item.unitPriceMillieme)}</TableCell>
                            <TableCell>
                              <Input
                                key={`${item.itemId}-${item.discountMillieme}`}
                                dir="rtl"
                                type="number"
                                min={0}
                                step="0.01"
                                className="w-24 text-center"
                                defaultValue={moneyToInput(item.discountMillieme)}
                                onBlur={(event) => {
                                  try {
                                    updateLineDiscount(
                                      item.itemId,
                                      toMillieme(event.target.value || 0),
                                    );
                                  } catch {
                                    updateLineDiscount(item.itemId, 0);
                                    event.target.value = "0";
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-semibold">
                              {formatEGP(item.totalMillieme)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => removeItem(item.itemId)}
                                aria-label="حذف الصنف"
                              >
                                <X />
                              </Button>
                            </TableCell>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border p-4">
                <SummaryRow label="المجموع الفرعي" value={formatEGP(subtotalMillieme)} />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">الخصم الإجمالي</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">ج.م</span>
                    <Input
                      key={`global-discount-${globalDiscountMillieme}`}
                      dir="rtl"
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-28 text-center"
                      defaultValue={moneyToInput(globalDiscountMillieme)}
                      onBlur={(event) => {
                        try {
                          setGlobalDiscount(toMillieme(event.target.value || 0));
                        } catch {
                          setGlobalDiscount(0);
                          event.target.value = "0";
                        }
                      }}
                    />
                  </div>
                </div>
                <Separator />
                <SummaryRow
                  label="الإجمالي"
                  value={formatEGP(totalMillieme)}
                  className="text-lg font-bold"
                />
                <div className="text-sm text-muted-foreground">
                  إجمالي الخصم: {formatEGP(totalDiscountMillieme)}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border p-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">العميل</label>
                  <div className="relative">
                    <UserRound className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      dir="rtl"
                      className="pe-9"
                      placeholder="اختر عميل (اختياري)"
                      value={customerSearch}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setCustomerSearch(nextValue);
                        if (customerId && nextValue !== customerName) {
                          clearCustomer();
                          setSelectedCustomer(null);
                        }
                      }}
                    />
                    {customerId ? (
                      <button
                        type="button"
                        className="absolute start-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={handleClearCustomer}
                        aria-label="مسح العميل"
                      >
                        <X className="size-4" />
                      </button>
                    ) : null}
                  </div>

                  {customersQuery.isSuccess && customerSearch.trim() !== "" && !customerId ? (
                    <div className="max-h-48 overflow-y-auto rounded-xl border bg-background">
                      {customerResults.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          لا يوجد عملاء مطابقون
                        </div>
                      ) : (
                        customerResults.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-right hover:bg-muted/40"
                            onClick={() => handleSelectCustomer(customer)}
                          >
                            <span>{customer.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {formatEGP(customer.balance_millieme)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>

                {selectedCustomer ? (
                  <div className="space-y-1 rounded-xl bg-muted/40 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{selectedCustomer.name}</span>
                      <span>{formatEGP(selectedCustomer.balance_millieme)}</span>
                    </div>
                    {selectedCustomer.balance_millieme > 0 ? (
                      <p className="font-medium text-amber-700">
                        مديونية: {formatEGP(selectedCustomer.balance_millieme)}
                      </p>
                    ) : selectedCustomer.balance_millieme < 0 ? (
                      <p className="font-medium text-emerald-700">
                        رصيد دائن للعميل: {formatEGP(Math.abs(selectedCustomer.balance_millieme))}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 rounded-2xl border p-4">
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(paymentMethodLabel) as Array<[PaymentMethod, string]>).map(
                    ([value, label]) => (
                      <PaymentTab
                        key={value}
                        active={paymentMethod === value}
                        onClick={() => setPaymentMethod(value)}
                      >
                        {label}
                      </PaymentTab>
                    ),
                  )}
                </div>

                {paymentMethod === "cash" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">المبلغ المدفوع</label>
                    <Input
                      dir="rtl"
                      type="number"
                      min={0}
                      step="0.01"
                      value={moneyToInput(paidCashMillieme)}
                      onChange={(event) => {
                        try {
                          setPaidCashAmount(toMillieme(event.target.value || 0));
                        } catch {
                          setPaidCashAmount(0);
                        }
                      }}
                    />
                    <p className="text-sm text-muted-foreground">
                      الباقي: {formatEGP(Math.max(changeMillieme, 0))}
                    </p>
                  </div>
                ) : null}

                {paymentMethod === "card" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">مبلغ الفيزا</label>
                    <Input
                      dir="rtl"
                      type="number"
                      min={0}
                      step="0.01"
                      value={moneyToInput(paidCardMillieme)}
                      onChange={(event) => {
                        try {
                          setPaidCardAmount(toMillieme(event.target.value || 0));
                        } catch {
                          setPaidCardAmount(0);
                        }
                      }}
                    />
                  </div>
                ) : null}

                {paymentMethod === "deferred" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">المدفوع الآن</label>
                    <Input
                      dir="rtl"
                      type="number"
                      min={0}
                      step="0.01"
                      value={moneyToInput(paidCashMillieme)}
                      onChange={(event) => {
                        try {
                          setPaidCashAmount(toMillieme(event.target.value || 0));
                          setPaidCardAmount(0);
                        } catch {
                          setPaidCashAmount(0);
                          setPaidCardAmount(0);
                        }
                      }}
                    />
                    <p className="text-sm text-muted-foreground">
                      المتبقي على الحساب: {formatEGP(deferredRemainingMillieme)}
                    </p>
                    <p className="text-sm font-medium text-amber-700">
                      سيتم تسجيل المتبقي كمديونية على العميل بعد خصم أي رصيد دائن متاح له.
                    </p>
                    {projectedCustomerBalanceMillieme !== null ? (
                      projectedCustomerBalanceMillieme > 0 ? (
                        <p className="text-sm font-medium text-amber-700">
                          الرصيد بعد البيع: مديونية {formatEGP(projectedCustomerBalanceMillieme)}
                        </p>
                      ) : projectedCustomerBalanceMillieme < 0 ? (
                        <p className="text-sm font-medium text-emerald-700">
                          الرصيد بعد البيع: دائن للعميل {formatEGP(Math.abs(projectedCustomerBalanceMillieme))}
                        </p>
                      ) : (
                        <p className="text-sm font-medium text-emerald-700">
                          الرصيد بعد البيع: ٠٫٠٠ ج.م
                        </p>
                      )
                    ) : null}
                  </div>
                ) : null}

                {paymentMethod === "split" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">نقدي</label>
                      <Input
                        dir="rtl"
                        type="number"
                        min={0}
                        step="0.01"
                        value={moneyToInput(paidCashMillieme)}
                        onChange={(event) => {
                          try {
                            setPaidCashAmount(toMillieme(event.target.value || 0));
                          } catch {
                            setPaidCashAmount(0);
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">فيزا</label>
                      <Input
                        dir="rtl"
                        type="number"
                        min={0}
                        step="0.01"
                        value={moneyToInput(paidCardMillieme)}
                        onChange={(event) => {
                          try {
                            setPaidCardAmount(toMillieme(event.target.value || 0));
                          } catch {
                            setPaidCardAmount(0);
                          }
                        }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground sm:col-span-2">
                      المدفوع حاليًا: {formatEGP(paidCashMillieme + paidCardMillieme)}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 rounded-2xl border p-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">ملاحظات</label>
                  <Input
                    dir="rtl"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="ملاحظات اختيارية"
                  />
                </div>

                <Button
                  size="lg"
                  className="h-12 w-full text-base font-semibold"
                  disabled={isSubmitDisabled}
                  onClick={() => void handleSubmitSale()}
                >
                  {createSaleMutation.isPending
                    ? "جارٍ حفظ الفاتورة..."
                    : `إتمام البيع — ${formatEGP(totalMillieme)}`}
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={isCartEmpty || createSaleMutation.isPending}
                  onClick={handleClearInvoice}
                >
                  <Trash2 />
                  مسح الفاتورة
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <InvoiceSuccessDialog
        open={Boolean(successInvoice)}
        invoice={successInvoice}
        onOpenChange={(open) => {
          if (!open) {
            setSuccessInvoice(null);
            focusSearchInput();
          }
        }}
        onPrint={() => toast("ميزة طباعة الفاتورة ستتوفر قريبًا")}
        onNewInvoice={handleNewInvoice}
      />
    </>
  );
}

function CategoryTab({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button variant={active ? "default" : "outline"} onClick={onClick}>
      {children}
    </Button>
  );
}

function PaymentTab({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      className={cn("flex-1", !active && "bg-background")}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function SummaryRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function TableHead({ children }: { children: ReactNode }) {
  return <th className="px-3 py-3 text-right font-medium">{children}</th>;
}

function TableCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={cn("px-3 py-3", className)}>{children}</td>;
}

function LoadingItemGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 9 }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-2xl border p-4">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-5 w-28" />
        </div>
      ))}
    </div>
  );
}
