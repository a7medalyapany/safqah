import {
  forwardRef,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Barcode,
  ChevronDown,
  CircleAlert,
  Loader2,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Category, Item } from "@/modules/items/types";
import { parseAppError } from "@/modules/items/utils";
import { invoke } from "@/shared/utils/invoke";

type SettingsMap = Record<string, string>;
type LabelSize = "30x20" | "40x25" | "50x30";

type GlobalSettings = {
  labelSize: LabelSize;
  showName: boolean;
  showPrice: boolean;
  showShopName: boolean;
  printer: string;
};

type SelectedEntry = {
  item: Item;
  quantity: number;
};

type BarcodeLabelConfig = {
  itemId: number;
  quantity: number;
  showName: boolean;
  showPrice: boolean;
  showShopName: boolean;
  labelSize: LabelSize;
};

const PAGE_SIZE = 20;

const LABEL_SIZE_OPTIONS: Array<{ value: LabelSize; label: string }> = [
  { value: "30x20", label: "30×20" },
  { value: "40x25", label: "40×25" },
  { value: "50x30", label: "50×30" },
];

const DEFAULT_SETTINGS: GlobalSettings = {
  labelSize: "40x25",
  showName: true,
  showPrice: true,
  showShopName: false,
  printer: "",
};

export const BulkBarcodePrintSection = forwardRef<HTMLDivElement, {}>(
  function BulkBarcodePrintSection(_, ref) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<number | null>(
      null,
    );
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [selectedItems, setSelectedItems] = useState<
      Map<number, SelectedEntry>
    >(() => new Map());
    const [globalSettings, setGlobalSettings] =
      useState<GlobalSettings>(DEFAULT_SETTINGS);
    const [isPrinterInitialized, setIsPrinterInitialized] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    const deferredSearch = useDeferredValue(searchQuery);

    const settingsQuery = useQuery({
      queryKey: ["settings"],
      queryFn: () =>
        invoke<SettingsMap>("get_settings", undefined, { toast: false }),
      staleTime: 30 * 1000,
    });

    const printersQuery = useQuery({
      queryKey: ["label-printers"],
      queryFn: () =>
        invoke<string[]>("get_label_printer_list", undefined, {
          toast: false,
        }),
      staleTime: 30 * 1000,
    });

    const categoriesQuery = useQuery({
      queryKey: ["dashboard-bulk-barcode-categories"],
      queryFn: () => invoke<Category[]>("list_categories"),
      staleTime: 30 * 1000,
    });

    const itemsQuery = useQuery({
      queryKey: ["dashboard-bulk-barcode-items"],
      queryFn: () =>
        invoke<Item[]>("list_items", { search: null, categoryId: null }),
      staleTime: 30 * 1000,
    });

    const stockFormatter = useMemo(() => new Intl.NumberFormat("ar-EG"), []);

    useEffect(() => {
      if (settingsQuery.error) {
        toast.error(parseAppError(settingsQuery.error).message_ar);
      }
    }, [settingsQuery.error]);

    useEffect(() => {
      if (printersQuery.error) {
        toast.error(parseAppError(printersQuery.error).message_ar);
      }
    }, [printersQuery.error]);

    useEffect(() => {
      if (categoriesQuery.error) {
        toast.error(parseAppError(categoriesQuery.error).message_ar);
      }
    }, [categoriesQuery.error]);

    useEffect(() => {
      if (itemsQuery.error) {
        toast.error(parseAppError(itemsQuery.error).message_ar);
      }
    }, [itemsQuery.error]);

    useEffect(() => {
      if (
        isPrinterInitialized ||
        settingsQuery.isLoading ||
        printersQuery.isLoading
      ) {
        return;
      }

      const defaultPrinter =
        settingsQuery.data?.label_printer?.trim() ||
        settingsQuery.data?.default_printer?.trim() ||
        printersQuery.data?.[0]?.trim() ||
        "";

      setGlobalSettings((current) =>
        current.printer
          ? current
          : {
              ...current,
              printer: defaultPrinter,
            },
      );
      setIsPrinterInitialized(true);
    }, [
      isPrinterInitialized,
      printersQuery.data,
      printersQuery.isLoading,
      settingsQuery.data,
      settingsQuery.isLoading,
    ]);

    useEffect(() => {
      setVisibleCount(PAGE_SIZE);
    }, [deferredSearch, selectedCategory]);

    const items = itemsQuery.data ?? [];
    const categories = categoriesQuery.data ?? [];

    const filteredItems = useMemo(() => {
      const normalizedSearch = deferredSearch.trim().toLowerCase();

      return items.filter((item) => {
        if (
          selectedCategory !== null &&
          item.category_id !== selectedCategory
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return [item.name_ar, item.name_en ?? "", item.barcode ?? ""].some(
          (value) => value.toLowerCase().includes(normalizedSearch),
        );
      });
    }, [deferredSearch, items, selectedCategory]);

    const visibleItems = filteredItems.slice(0, visibleCount);
    const hasMoreItems = visibleCount < filteredItems.length;
    const barcodedFilteredItems = filteredItems.filter((item) =>
      Boolean(item.barcode?.trim()),
    );

    const selectedEntries = useMemo(
      () => Array.from(selectedItems.values()),
      [selectedItems],
    );
    const validSelectedEntries = useMemo(
      () =>
        selectedEntries.filter((entry) => Boolean(entry.item.barcode?.trim())),
      [selectedEntries],
    );
    const totalLabels = validSelectedEntries.reduce(
      (sum, entry) => sum + entry.quantity,
      0,
    );
    const selectedItemCount = selectedEntries.length;

    const printerOptions = useMemo(() => {
      const printers = printersQuery.data ?? [];
      const preferredPrinter =
        settingsQuery.data?.label_printer?.trim() ||
        settingsQuery.data?.default_printer?.trim() ||
        "";

      return Array.from(
        new Set([
          preferredPrinter,
          ...printers.map((printer) => printer.trim()).filter(Boolean),
        ]),
      ).filter(Boolean);
    }, [printersQuery.data, settingsQuery.data]);

    const toggleItem = (item: Item) => {
      if (!item.barcode?.trim()) {
        return;
      }

      setSelectedItems((current) => {
        const next = new Map(current);

        if (next.has(item.id)) {
          next.delete(item.id);
        } else {
          next.set(item.id, { item, quantity: 1 });
        }

        return next;
      });
    };

    const updateQuantity = (itemId: number, quantity: number) => {
      setSelectedItems((current) => {
        const entry = current.get(itemId);
        if (!entry) {
          return current;
        }

        const next = new Map(current);
        next.set(itemId, {
          ...entry,
          quantity: Math.min(100, Math.max(1, quantity)),
        });

        return next;
      });
    };

    const selectAllFiltered = () => {
      setSelectedItems((current) => {
        const next = new Map(current);

        for (const item of barcodedFilteredItems) {
          if (!next.has(item.id)) {
            next.set(item.id, { item, quantity: 1 });
          }
        }

        return next;
      });
    };

    const clearSelection = () => {
      setSelectedItems(new Map());
    };

    const handlePrint = async () => {
      if (validSelectedEntries.length === 0) {
        toast.error("لا توجد أصناف صالحة للطباعة");
        return;
      }

      const configs: BarcodeLabelConfig[] = validSelectedEntries.map(
        (entry) => ({
          itemId: entry.item.id,
          quantity: entry.quantity,
          showName: globalSettings.showName,
          showPrice: globalSettings.showPrice,
          showShopName: globalSettings.showShopName,
          labelSize: globalSettings.labelSize,
        }),
      );

      console.log("print_barcode_labels configs", configs);

      const loadingToastId = toast.loading(`جاري طباعة ${totalLabels} ملصق...`);
      setIsPrinting(true);

      try {
        if (globalSettings.printer.trim()) {
          await invoke<boolean>(
            "update_settings",
            { updates: { label_printer: globalSettings.printer.trim() } },
            { toast: false },
          );
        }

        await invoke<boolean>(
          "print_barcode_labels",
          { configs },
          { toast: false },
        );

        if (selectedEntries.length !== validSelectedEntries.length) {
          toast.success(
            `تم طباعة ${totalLabels} ملصق — فشل ${selectedEntries.length - validSelectedEntries.length} صنف`,
            { id: loadingToastId },
          );
        } else {
          toast.success(`تم إرسال ${totalLabels} ملصق للطابعة`, {
            id: loadingToastId,
          });
        }

        clearSelection();
      } catch (error) {
        toast.error(parseAppError(error).message_ar, { id: loadingToastId });
      } finally {
        setIsPrinting(false);
      }
    };

    return (
      <div ref={ref} id="barcode-bulk-print" className="scroll-mt-24">
        <Collapsible defaultOpen={false}>
          <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex w-full items-start justify-between gap-4 px-4 py-4 text-right transition-colors hover:bg-muted/30"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <Barcode className="size-5 text-primary" />
                    <span>طباعة ملصقات الباركود</span>
                  </div>
                  <CardDescription className="text-sm text-muted-foreground">
                    اطبع ملصقات لأصناف متعددة دفعة واحدة
                  </CardDescription>
                </div>

                <ChevronDown className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="space-y-4 border-t px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row-reverse lg:items-center lg:justify-between">
                  <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                    <div className="relative flex-1">
                      <Search className="absolute inset-e-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        dir="rtl"
                        className="pe-9"
                        placeholder="ابحث بالاسم أو الباركود..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                      />
                    </div>

                    <select
                      dir="rtl"
                      className="h-8 min-w-52 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      value={selectedCategory?.toString() ?? ""}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setSelectedCategory(
                          nextValue ? Number(nextValue) : null,
                        );
                      }}
                    >
                      <option value="">جميع التصنيفات</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name_ar}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-start">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAllFiltered}
                      disabled={barcodedFilteredItems.length === 0}
                    >
                      تحديد الكل
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearSelection}
                      disabled={selectedItemCount === 0}
                    >
                      إلغاء التحديد
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handlePrint}
                      disabled={totalLabels === 0 || isPrinting}
                    >
                      {isPrinting ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Printer />
                      )}
                      طباعة المحدد ({totalLabels})
                    </Button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border">
                  <div className="overflow-x-auto">
                    <table
                      dir="rtl"
                      className="min-w-[920px] w-full border-collapse text-right"
                    >
                      <thead className="bg-muted/40 text-sm text-muted-foreground">
                        <tr>
                          <ThCell className="w-12">☐</ThCell>
                          <ThCell>الصنف</ThCell>
                          <ThCell>الباركود</ThCell>
                          <ThCell className="w-32">المخزون الحالي</ThCell>
                          <ThCell className="w-44">عدد النسخ</ThCell>
                          <ThCell className="w-28">الإجراء</ThCell>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {itemsQuery.isLoading ? (
                          Array.from({ length: 5 }).map((_, index) => (
                            <tr key={index}>
                              {Array.from({ length: 6 }).map(
                                (__, cellIndex) => (
                                  <td key={cellIndex} className="p-3">
                                    <div className="h-8 animate-pulse rounded-lg bg-muted" />
                                  </td>
                                ),
                              )}
                            </tr>
                          ))
                        ) : visibleItems.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-10 text-center">
                              <div className="space-y-2 text-sm text-muted-foreground">
                                <p>
                                  لا توجد أصناف مطابقة للبحث أو التصنيف الحالي.
                                </p>
                                <p>
                                  يمكنك تعديل البحث أو الضغط على تحميل المزيد
                                  عند الحاجة.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          visibleItems.map((item) => {
                            const hasBarcode = Boolean(item.barcode?.trim());
                            const isSelected = selectedItems.has(item.id);
                            const selectedEntry = selectedItems.get(item.id);

                            return (
                              <tr
                                key={item.id}
                                className={cn(
                                  "transition-colors hover:bg-muted/30",
                                  !hasBarcode &&
                                    "bg-muted/40 text-muted-foreground",
                                )}
                              >
                                <TdCell>
                                  <input
                                    type="checkbox"
                                    className="size-4 accent-primary"
                                    checked={isSelected}
                                    disabled={!hasBarcode}
                                    onChange={() => toggleItem(item)}
                                    aria-label={`تحديد ${item.name_ar}`}
                                  />
                                </TdCell>
                                <TdCell>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {item.name_ar}
                                    </span>
                                    {!hasBarcode && (
                                      <span title="لا يوجد باركود">
                                        <CircleAlert className="size-4 text-amber-500" />
                                      </span>
                                    )}
                                  </div>
                                </TdCell>
                                <TdCell>
                                  {hasBarcode ? (
                                    <span className="font-mono text-sm tracking-[0.18em]">
                                      {item.barcode}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                                      <CircleAlert className="size-3.5" />
                                      لا يوجد باركود
                                    </span>
                                  )}
                                </TdCell>
                                <TdCell>
                                  {stockFormatter.format(item.current_stock)}
                                </TdCell>
                                <TdCell>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={selectedEntry?.quantity ?? 1}
                                    disabled={!isSelected || !hasBarcode}
                                    className="h-9 text-center"
                                    onChange={(event) => {
                                      updateQuantity(
                                        item.id,
                                        Number(event.target.value) || 1,
                                      );
                                    }}
                                  />
                                </TdCell>
                                <TdCell>
                                  <Button
                                    type="button"
                                    variant={
                                      isSelected ? "destructive" : "outline"
                                    }
                                    size="sm"
                                    onClick={() => toggleItem(item)}
                                    disabled={!hasBarcode}
                                  >
                                    {isSelected ? <Trash2 /> : <Barcode />}
                                    {isSelected ? "إزالة" : "اختيار"}
                                  </Button>
                                </TdCell>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {hasMoreItems && (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setVisibleCount((current) => current + PAGE_SIZE)
                      }
                    >
                      تحميل المزيد
                    </Button>
                  </div>
                )}

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(0,0.95fr)]">
                  <SettingsCard title="حجم الملصق">
                    <div className="grid gap-2 sm:grid-cols-3">
                      {LABEL_SIZE_OPTIONS.map((option) => (
                        <label
                          key={option.value}
                          className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm transition-colors hover:bg-muted/40"
                        >
                          <input
                            type="radio"
                            name="bulk-label-size"
                            checked={globalSettings.labelSize === option.value}
                            onChange={() =>
                              setGlobalSettings((current) => ({
                                ...current,
                                labelSize: option.value,
                              }))
                            }
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </SettingsCard>

                  <SettingsCard title="محتوى الملصق">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <ToggleCheckbox
                        label="اسم الصنف"
                        checked={globalSettings.showName}
                        onChange={(checked) =>
                          setGlobalSettings((current) => ({
                            ...current,
                            showName: checked,
                          }))
                        }
                      />
                      <ToggleCheckbox
                        label="السعر"
                        checked={globalSettings.showPrice}
                        onChange={(checked) =>
                          setGlobalSettings((current) => ({
                            ...current,
                            showPrice: checked,
                          }))
                        }
                      />
                      <ToggleCheckbox
                        label="اسم المحل"
                        checked={globalSettings.showShopName}
                        onChange={(checked) =>
                          setGlobalSettings((current) => ({
                            ...current,
                            showShopName: checked,
                          }))
                        }
                      />
                    </div>
                  </SettingsCard>

                  <SettingsCard title="الطابعة">
                    <select
                      dir="rtl"
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      value={globalSettings.printer}
                      onChange={(event) =>
                        setGlobalSettings((current) => ({
                          ...current,
                          printer: event.target.value,
                        }))
                      }
                    >
                      <option value="">استخدام الطابعة الافتراضية</option>
                      {printerOptions.map((printer) => (
                        <option key={printer} value={printer}>
                          {printer}
                        </option>
                      ))}
                    </select>
                  </SettingsCard>
                </div>

                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground">
                    سيتم طباعة {totalLabels} ملصق لـ {selectedItemCount} صنف
                  </p>
                </div>

                <Button
                  type="button"
                  className="h-12 w-full text-base"
                  disabled={totalLabels === 0 || isPrinting}
                  onClick={handlePrint}
                >
                  {isPrinting ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Printer />
                  )}
                  طباعة {totalLabels} ملصق
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    );
  },
);

function SettingsCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="mb-3 text-sm font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function ToggleCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function ThCell({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <th className={cn("px-3 py-3 font-medium", className)}>{children}</th>;
}

function TdCell({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <td className={cn("px-3 py-3 align-middle", className)}>{children}</td>
  );
}
