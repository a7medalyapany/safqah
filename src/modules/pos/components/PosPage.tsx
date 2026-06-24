import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { CatalogPanel } from "@/modules/pos/components/CatalogPanel";
import { CartTable } from "@/modules/pos/components/CartTable";
import { CustomerPanel } from "@/modules/pos/components/CustomerPanel";
import { InvoiceActionsPanel } from "@/modules/pos/components/InvoiceActionsPanel";
import { InvoiceItemAdjustDialog } from "@/modules/pos/components/InvoiceItemAdjustDialog";
import {
  InvoiceSuccessDialog,
  type SaleInvoiceSuccess,
} from "@/modules/pos/InvoiceSuccessDialog";
import { PaymentPanel } from "@/modules/pos/components/PaymentPanel";
import { TotalsPanel } from "@/modules/pos/components/TotalsPanel";
import {
  ensureCashPaidAtLeastTotal,
  shouldSyncCashPaidToTotal,
} from "@/modules/pos/paymentRules";
import {
  generateInvoicePdf,
  getInvoicePrintData,
  openWhatsappWithInvoice,
} from "@/modules/pos/api";
import type { Customer } from "@/modules/parties/types";
import type { Item } from "@/modules/items/types";
import { parseAppError } from "@/modules/items/utils";
import {
  useCreateSaleInvoice,
  useCustomerSearch,
  usePosCategories,
  usePosItems,
} from "@/modules/pos/hooks";
import type { PaymentMethod } from "@/modules/pos/types";
import { buildSalePayload } from "@/modules/pos/utils";
import { useBarcodeScanner } from "@/shared/hooks/useBarcodeScanner";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { formatEGP } from "@/shared/utils/money";
import { printHtml } from "@/shared/utils/printHtml";
import { useCartStore } from "@/store/cartSlice";
import { useSessionStore } from "@/store/sessionSlice";
import { Button } from "@/components/ui/button";
import { OpenSessionDialog } from "@/modules/sessions/OpenSessionDialog";

export default function PosPage() {
  const queryClient = useQueryClient();
  const activeSession = useSessionStore((state) => state.activeSession);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const itemClickTimeoutRef = useRef<number | null>(null);

  const cartItems = useCartStore((state) => state.items);
  const customerId = useCartStore((state) => state.customerId);
  const customerName = useCartStore((state) => state.customerName);
  const globalDiscountMillieme = useCartStore(
    (state) => state.globalDiscountMillieme,
  );
  const paymentMethod = useCartStore((state) => state.paymentMethod);
  const paidCashMillieme = useCartStore((state) => state.paidCashMillieme);
  const paidCardMillieme = useCartStore((state) => state.paidCardMillieme);
  const notes = useCartStore((state) => state.notes);
  const subtotalMillieme = useCartStore((state) => state.subtotalMillieme());
  const totalDiscountMillieme = useCartStore((state) =>
    state.totalDiscountMillieme(),
  );
  const totalMillieme = useCartStore((state) => state.totalMillieme());
  const changeMillieme = useCartStore((state) => state.changeMillieme());

  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQty = useCartStore((state) => state.updateQty);
  const updateLineDiscountPercent = useCartStore(
    (state) => state.updateLineDiscountPercent,
  );
  const updateLineUnitPrice = useCartStore(
    (state) => state.updateLineUnitPrice,
  );
  const setGlobalDiscount = useCartStore((state) => state.setGlobalDiscount);
  const setCustomer = useCartStore((state) => state.setCustomer);
  const clearCustomer = useCartStore((state) => state.clearCustomer);
  const setPaymentMethod = useCartStore((state) => state.setPaymentMethod);
  const setPaidCashAmount = useCartStore((state) => state.setPaidCashAmount);
  const setPaidCardAmount = useCartStore((state) => state.setPaidCardAmount);
  const setNotes = useCartStore((state) => state.setNotes);
  const clearCart = useCartStore((state) => state.clearCart);

  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [adjustedItem, setAdjustedItem] = useState<Item | null>(null);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [openSessionDialogOpen, setOpenSessionDialogOpen] = useState(false);
  const [successInvoice, setSuccessInvoice] =
    useState<SaleInvoiceSuccess | null>(null);
  const [whatsappPdfPath, setWhatsappPdfPath] = useState<string | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 150);
  const debouncedCustomerSearch = useDebouncedValue(customerSearch, 150);

  const focusSearchInput = () => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  };

  if (!activeSession) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
        <div className="text-7xl">🔒</div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">لا توجد وردية مفتوحة</h2>
          <p className="text-muted-foreground text-lg">
            يجب فتح وردية للبدء في تسجيل المبيعات
          </p>
        </div>
        <Button
          size="lg"
          className="px-8"
          onClick={() => setOpenSessionDialogOpen(true)}
        >
          ⚡ بدء وردية جديدة
        </Button>
        <OpenSessionDialog
          open={openSessionDialogOpen}
          onOpenChange={setOpenSessionDialogOpen}
        />
      </div>
    );
  }

  const handlePrintInvoice = async () => {
    if (!successInvoice) {
      return;
    }

    try {
      const data = await getInvoicePrintData(successInvoice.id);
      const itemsHtml = data.items
        .map(
          (item) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right">${item.itemNameAr}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">${item.qty}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">${formatEGP(item.unitPriceMillieme)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">${formatEGP(item.discountMillieme)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:left">${formatEGP(item.totalMillieme)}</td>
        </tr>`,
        )
        .join("");

      const html = `
        <html dir="rtl" lang="ar">
          <head><meta charset="utf-8"><title>فاتورة ${data.invoiceNumber}</title>
          <style>
            body{font-family:'Segoe UI',Tahoma,Arial;padding:20px;margin:0;direction:rtl}
            .header{text-align:center;margin-bottom:16px}
            .header h1{margin:0;font-size:18px}
            .header p{margin:2px 0;font-size:13px;color:#555}
            table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
            th{background:#f5f5f5;padding:6px 8px;border-bottom:2px solid #ddd;text-align:right}
            .totals{margin-top:12px;font-size:13px}
            .totals div{display:flex;justify-content:space-between;padding:3px 0}
            .totals .grand{font-weight:bold;font-size:15px;border-top:2px solid #333;padding-top:6px;margin-top:4px}
            .footer{text-align:center;margin-top:16px;font-size:12px;color:#888}
          </style></head>
          <body>
            <div class="header">
              <h1>${data.shop.shopName}</h1>
              ${data.shop.shopAddress ? `<p>${data.shop.shopAddress}</p>` : ""}
              ${data.shop.shopPhone ? `<p>${data.shop.shopPhone}</p>` : ""}
              <p>رقم الفاتورة: ${data.invoiceNumber}</p>
              ${data.cashierName ? `<p>الكاشير: ${data.cashierName}</p>` : ""}
              ${data.customerName ? `<p>العميل: ${data.customerName}</p>` : ""}
            </div>
            <table>
              <thead><tr>
                <th style="text-align:right">الصنف</th>
                <th style="text-align:center">الكمية</th>
                <th style="text-align:center">السعر</th>
                <th style="text-align:center">الخصم</th>
                <th style="text-align:left">الإجمالي</th>
              </tr></thead>
              <tbody>${itemsHtml}</tbody>
            </table>
            <div class="totals">
              <div><span>المجموع الفرعي</span><span>${formatEGP(data.subtotalMillieme)}</span></div>
              ${data.discountMillieme ? `<div><span>الخصم</span><span>${formatEGP(data.discountMillieme)}</span></div>` : ""}
              <div class="grand"><span>الإجمالي</span><span>${formatEGP(data.totalMillieme)}</span></div>
              <div><span>المدفوع</span><span>${formatEGP(data.paidMillieme)}</span></div>
            </div>
            <div class="footer">شكراً لزيارتكم</div>
          </body>
        </html>`;
      printHtml(html);
      toast.success("جاري الطباعة...");
    } catch (error) {
      toast.error(parseAppError(error).message_ar);
    }
  };

  const handleSendWhatsapp = async () => {
    if (!successInvoice) {
      return;
    }

    setWhatsappLoading(true);

    try {
      const pdfPath = await generateInvoicePdf(successInvoice.id);
      setWhatsappPdfPath(pdfPath);
      toast.success(`تم حفظ الفاتورة في: ${pdfPath}`);

      await openWhatsappWithInvoice({
        invoiceId: successInvoice.id,
        invoiceNumber: successInvoice.invoice_number,
      });

      toast.success("تم فتح واتساب، اختر جهة الاتصال ثم أرفق ملف PDF");
    } catch (error) {
      toast.error(parseAppError(error).message_ar);
    } finally {
      setWhatsappLoading(false);
    }
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
    if (
      shouldSyncCashPaidToTotal({
        paymentMethod,
        paidCashMillieme,
        totalMillieme,
      })
    ) {
      setPaidCashAmount(totalMillieme);
    }
  }, [paidCashMillieme, paymentMethod, setPaidCashAmount, totalMillieme]);

  useEffect(() => {
    if (!customerId) {
      setSelectedCustomer(null);
      setCustomerSearch("");
    }
  }, [customerId]);

  useBarcodeScanner((barcode) => {
    setSearch(barcode);
    focusSearchInput();
  }, !successInvoice);

  const categoriesQuery = usePosCategories();
  const itemsQuery = usePosItems(debouncedSearch, selectedCategoryId);
  const customersQuery = useCustomerSearch(debouncedCustomerSearch);
  const createSaleMutation = useCreateSaleInvoice();

  const items = itemsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const customerResults = customersQuery.data ?? [];
  const selectedCustomerBalanceMillieme =
    selectedCustomer?.balance_millieme ?? 0;
  const deferredPaidNowMillieme =
    paymentMethod === "deferred" ? paidCashMillieme + paidCardMillieme : 0;
  const deferredRemainingMillieme =
    paymentMethod === "deferred"
      ? Math.max(totalMillieme - deferredPaidNowMillieme, 0)
      : 0;
  // How the selected customer's balance changes after this sale.
  //  - deferred: total - paidNow (positive = owes us, negative = store credit)
  //  - cash overpayment: the excess becomes store credit (negative)
  let customerBalanceDeltaMillieme: number | null = null;
  if (selectedCustomer) {
    if (paymentMethod === "deferred") {
      customerBalanceDeltaMillieme = totalMillieme - deferredPaidNowMillieme;
    } else if (paymentMethod === "cash" && paidCashMillieme > totalMillieme) {
      customerBalanceDeltaMillieme = totalMillieme - paidCashMillieme;
    }
  }
  const projectedCustomerBalanceMillieme =
    customerBalanceDeltaMillieme !== null
      ? selectedCustomerBalanceMillieme + customerBalanceDeltaMillieme
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

    setAdjustedItem(item);
    setIsAdjustDialogOpen(true);
  };

  const handleConfirmAdjustedItem = ({
    unitPriceMillieme,
    discountPercent,
  }: {
    unitPriceMillieme: number;
    discountPercent: number;
  }) => {
    if (!adjustedItem) {
      return;
    }

    addItem(adjustedItem, {
      unitPriceMillieme,
      discountPercent,
    });
    setAdjustedItem(null);
    focusSearchInput();
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
    setWhatsappLoading(false);
    setWhatsappPdfPath(null);
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
    setWhatsappLoading(false);
    setWhatsappPdfPath(null);
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

    if (
      paymentMethod === "deferred" &&
      paidCashMillieme + paidCardMillieme > totalMillieme
    ) {
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

    await createSaleMutation.mutateAsync(payload, {
      onSuccess: async (invoice) => {
        setSuccessInvoice(invoice);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["pos-items"] }),
          queryClient.invalidateQueries({ queryKey: ["items"] }),
          queryClient.invalidateQueries({ queryKey: ["customers"] }),
          queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        ]);
      },
      onError: (error) => {
        toast.error(parseAppError(error).message_ar);
      },
    });
  };

  return (
    <>
      <div className="min-h-[calc(100vh-81px)] p-4 lg:p-6">
        <div className="flex h-full flex-col gap-4 lg:flex-row-reverse">
          <CatalogPanel
            searchInputRef={searchInputRef}
            search={search}
            onSearchChange={setSearch}
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            items={items}
            isLoading={itemsQuery.isLoading}
            onItemClick={handleItemCardClick}
            onItemDoubleClick={handleItemCardDoubleClick}
          />

          <Card className="flex min-h-[70vh] flex-col lg:basis-[40%]">
            <CardContent className="flex flex-1 flex-col gap-4 p-4">
              <CartTable
                items={cartItems}
                onUpdateQty={updateQty}
                onUpdateLineDiscountPercent={updateLineDiscountPercent}
                onUpdateLineUnitPrice={updateLineUnitPrice}
                onRemoveItem={removeItem}
              />

              <TotalsPanel
                subtotalMillieme={subtotalMillieme}
                globalDiscountMillieme={globalDiscountMillieme}
                totalMillieme={totalMillieme}
                totalDiscountMillieme={totalDiscountMillieme}
                onSetGlobalDiscount={setGlobalDiscount}
              />

              <CustomerPanel
                customerSearch={customerSearch}
                customerId={customerId}
                onCustomerSearchChange={(value) => {
                  setCustomerSearch(value);
                  if (customerId && value !== customerName) {
                    clearCustomer();
                    setSelectedCustomer(null);
                  }
                }}
                onClearCustomer={handleClearCustomer}
                onSelectCustomer={handleSelectCustomer}
                customers={customerResults}
                showResults={
                  customersQuery.isSuccess &&
                  customerSearch.trim() !== "" &&
                  !customerId
                }
                selectedCustomer={selectedCustomer}
              />

              <PaymentPanel
                paymentMethod={paymentMethod}
                paymentMethodLabel={paymentMethodLabel}
                onSetPaymentMethod={setPaymentMethod}
                totalMillieme={totalMillieme}
                paidCashMillieme={paidCashMillieme}
                paidCardMillieme={paidCardMillieme}
                changeMillieme={changeMillieme}
                deferredRemainingMillieme={deferredRemainingMillieme}
                projectedCustomerBalanceMillieme={
                  projectedCustomerBalanceMillieme
                }
                onSetPaidCashAmount={setPaidCashAmount}
                onSetPaidCardAmount={setPaidCardAmount}
                onEnsureCashPaidAtLeastTotal={ensureCashPaidAtLeastTotal}
              />

              <InvoiceActionsPanel
                notes={notes}
                onNotesChange={setNotes}
                isSubmitDisabled={isSubmitDisabled}
                isSubmitting={createSaleMutation.isPending}
                totalLabel={formatEGP(totalMillieme)}
                onSubmit={() => void handleSubmitSale()}
                onClear={handleClearInvoice}
              />
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
            setWhatsappLoading(false);
            setWhatsappPdfPath(null);
            focusSearchInput();
          }
        }}
        onPrint={() => void handlePrintInvoice()}
        onWhatsapp={() => void handleSendWhatsapp()}
        onNewInvoice={handleNewInvoice}
        whatsappLoading={whatsappLoading}
        pdfPath={whatsappPdfPath}
      />

      <InvoiceItemAdjustDialog
        open={isAdjustDialogOpen}
        item={adjustedItem}
        onOpenChange={(open) => {
          setIsAdjustDialogOpen(open);
          if (!open) {
            setAdjustedItem(null);
          }
        }}
        onConfirm={handleConfirmAdjustedItem}
      />
    </>
  );
}
