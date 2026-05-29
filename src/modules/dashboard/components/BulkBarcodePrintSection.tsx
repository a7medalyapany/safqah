import {
  forwardRef,
  useEffect,
  useMemo,
  useDeferredValue,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Barcode, Loader2, Printer, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/shared/components/SectionCard";
import type { Item } from "@/modules/items/types";
import { formatEGP } from "@/shared/utils/money";
import { parseAppError } from "@/modules/items/utils";
import { invoke } from "@/shared/utils/invoke";

type SettingsMap = Record<string, string>;
type LabelSize = "30x20" | "40x25" | "50x30";

type SelectedItem = {
  item: Item;
  quantity: number;
};

type PrintConfig = {
  itemId: number;
  quantity: number;
  showName: boolean;
  showPrice: boolean;
  showShopName: boolean;
  labelSize: LabelSize;
};

const LABEL_SIZE_OPTIONS: Array<{ value: LabelSize; label: string }> = [
  { value: "30x20", label: "30×20 مم" },
  { value: "40x25", label: "40×25 مم" },
  { value: "50x30", label: "50×30 مم" },
];

export const BulkBarcodePrintSection = forwardRef<HTMLDivElement>(
  function BulkBarcodePrintSection(_, ref) {
    const [search, setSearch] = useState("");
    const [selectedItems, setSelectedItems] = useState<
      Record<number, SelectedItem>
    >({});
    const [selectedPrinter, setSelectedPrinter] = useState("");
    const [isPrinterInitialized, setIsPrinterInitialized] = useState(false);
    const [showName, setShowName] = useState(true);
    const [showPrice, setShowPrice] = useState(true);
    const [showShopName, setShowShopName] = useState(false);
    const [labelSize, setLabelSize] = useState<LabelSize>("40x25");
    const [isPrinting, setIsPrinting] = useState(false);

    const deferredSearch = useDeferredValue(search);

    const settingsQuery = useQuery({
      queryKey: ["settings"],
      queryFn: () =>
        invoke<SettingsMap>("get_settings", undefined, { toast: false }),
      staleTime: 30 * 1000,
    });

    const printersQuery = useQuery({
      queryKey: ["label-printers"],
      queryFn: () =>
        invoke<string[]>("get_label_printer_list", undefined, { toast: false }),
      staleTime: 30 * 1000,
    });

    const itemsQuery = useQuery({
      queryKey: ["items", deferredSearch.trim(), null],
      queryFn: () =>
        invoke<Item[]>("list_items", {
          search: deferredSearch.trim() || null,
          categoryId: null,
        }),
      staleTime: 30 * 1000,
    });

    const items = itemsQuery.data ?? [];
    const selectedConfigs = useMemo<PrintConfig[]>(
      () =>
        Object.values(selectedItems).map((entry) => ({
          itemId: entry.item.id,
          quantity: entry.quantity,
          showName,
          showPrice,
          showShopName,
          labelSize,
        })),
      [labelSize, selectedItems, showName, showPrice, showShopName],
    );
    const totalLabels = selectedConfigs.reduce(
      (sum, config) => sum + config.quantity,
      0,
    );

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
      if (isPrinterInitialized) {
        return;
      }

      const defaultPrinter =
        settingsQuery.data?.label_printer?.trim() ||
        settingsQuery.data?.default_printer?.trim() ||
        printersQuery.data?.[0]?.trim() ||
        "";

      setSelectedPrinter(defaultPrinter);
      setIsPrinterInitialized(true);
    }, [isPrinterInitialized, printersQuery.data, settingsQuery.data]);

    const toggleItem = (item: Item) => {
      if (!item.barcode?.trim()) {
        return;
      }

      setSelectedItems((current) => {
        if (current[item.id]) {
          const next = { ...current };
          delete next[item.id];
          return next;
        }

        return {
          ...current,
          [item.id]: {
            item,
            quantity: 1,
          },
        };
      });
    };

    const handlePrint = async () => {
      if (selectedConfigs.length === 0) {
        return;
      }

      setIsPrinting(true);

      try {
        if (selectedPrinter.trim()) {
          await invoke<boolean>(
            "update_settings",
            { updates: { label_printer: selectedPrinter.trim() } },
            { toast: false },
          );
        }

        await invoke<boolean>(
          "print_barcode_labels",
          { configs: selectedConfigs },
          { toast: false },
        );

        toast.success("جاري الطباعة...", {
          description: `${totalLabels} ${totalLabels === 1 ? "ملصق" : "ملصقات"}`,
        });
        setSelectedItems({});
      } catch (error) {
        toast.error(parseAppError(error).message_ar);
      } finally {
        setIsPrinting(false);
      }
    };

    const clearSelection = () => setSelectedItems({});

    return (
      <div ref={ref} id="barcode-bulk-print" className="scroll-mt-24">
        <SectionCard
          title="طباعة باركود جماعية"
          action={
            selectedConfigs.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <Trash2 className="size-4" />
                مسح الاختيار
              </Button>
            ) : null
          }
          className="border-border/70 bg-card shadow-sm"
          contentClassName="space-y-4"
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute inset-e-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  dir="rtl"
                  className="pe-9"
                  placeholder="ابحث باسم الصنف أو الباركود..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <ControlCard title="الطابعة">
                  <select
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={selectedPrinter}
                    onChange={(event) => setSelectedPrinter(event.target.value)}
                  >
                    <option value="">استخدام الطابعة الافتراضية</option>
                    {printerOptions.map((printer) => (
                      <option key={printer} value={printer}>
                        {printer}
                      </option>
                    ))}
                  </select>
                </ControlCard>

                <ControlCard title="حجم الملصق">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {LABEL_SIZE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm transition-colors hover:bg-muted/40"
                      >
                        <input
                          type="radio"
                          name="bulk-label-size"
                          checked={labelSize === option.value}
                          onChange={() => setLabelSize(option.value)}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </ControlCard>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <ToggleCheckbox
                  label="اسم الصنف"
                  checked={showName}
                  onChange={setShowName}
                />
                <ToggleCheckbox
                  label="السعر"
                  checked={showPrice}
                  onChange={setShowPrice}
                />
                <ToggleCheckbox
                  label="اسم المحل"
                  checked={showShopName}
                  onChange={setShowShopName}
                />
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    نتائج البحث
                  </p>
                  <BadgeValue>{items.length} صنف</BadgeValue>
                </div>

                {itemsQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-14 animate-pulse rounded-xl bg-muted"
                      />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                    لا توجد أصناف مطابقة للبحث الحالي.
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {items.map((item) => {
                      const isSelected = Boolean(selectedItems[item.id]);

                      return (
                        <div
                          key={item.id}
                          className="flex flex-col gap-3 rounded-xl border bg-background p-3 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{item.name_ar}</p>
                              {item.barcode ? (
                                <BadgeValue>{item.barcode}</BadgeValue>
                              ) : (
                                <BadgeValue tone="amber">
                                  بدون باركود
                                </BadgeValue>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {formatEGP(item.sell_price_millieme)}
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant={isSelected ? "destructive" : "outline"}
                            size="sm"
                            onClick={() => toggleItem(item)}
                            disabled={!item.barcode?.trim()}
                          >
                            <Barcode className="size-4" />
                            {isSelected ? "إزالة" : "إضافة"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 xl:sticky xl:top-0">
              <ControlCard title="العناصر المختارة">
                {selectedConfigs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    لم يتم اختيار أي أصناف بعد.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.values(selectedItems).map(({ item, quantity }) => (
                      <div
                        key={item.id}
                        className="space-y-2 rounded-xl border bg-background p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <p className="font-medium">{item.name_ar}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.barcode}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => toggleItem(item)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            النسخ
                          </span>
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            value={quantity}
                            onChange={(event) => {
                              const nextValue = Math.min(
                                100,
                                Math.max(1, Number(event.target.value) || 1),
                              );

                              setSelectedItems((current) => ({
                                ...current,
                                [item.id]: {
                                  ...current[item.id],
                                  quantity: nextValue,
                                },
                              }));
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ControlCard>

              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      إجمالي الملصقات
                    </p>
                    <p className="text-2xl font-semibold">{totalLabels}</p>
                  </div>
                  <Button
                    type="button"
                    className="min-w-32"
                    disabled={selectedConfigs.length === 0 || isPrinting}
                    onClick={handlePrint}
                  >
                    {isPrinting ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Printer />
                    )}
                    طباعة {totalLabels} {totalLabels === 1 ? "ملصق" : "ملصقات"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  },
);

function ControlCard({
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

function BadgeValue({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "amber";
}) {
  return (
    <span
      className={
        tone === "amber"
          ? "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
          : "rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
      }
    >
      {children}
    </span>
  );
}
