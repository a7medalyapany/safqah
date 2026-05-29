import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Barcode from "react-barcode";
import { Loader2, Pencil, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Item } from "@/modules/items/types";
import { parseAppError } from "@/modules/items/utils";
import { formatEGP } from "@/shared/utils/money";
import { invoke } from "@/shared/utils/invoke";

type SettingsMap = Record<string, string>;

type PrintBarcodeDialogProps = {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditItem?: () => void;
};

type LabelSize = "30x20" | "40x25" | "50x30";

const LABEL_SIZE_OPTIONS: Array<{ value: LabelSize; label: string }> = [
  { value: "30x20", label: "30×20 مم (صغير)" },
  { value: "40x25", label: "40×25 مم (متوسط)" },
  { value: "50x30", label: "50×30 مم (كبير)" },
];

export function PrintBarcodeDialog({
  item,
  open,
  onOpenChange,
  onEditItem,
}: PrintBarcodeDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showShopName, setShowShopName] = useState(false);
  const [labelSize, setLabelSize] = useState<LabelSize>("40x25");
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);

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

  const barcode = item?.barcode?.trim() ?? "";
  const hasBarcode = barcode.length > 0;
  const shopName =
    settingsQuery.data?.shop_name?.trim() ||
    settingsQuery.data?.shopName?.trim() ||
    "اسم المحل";

  const printerOptions = useMemo(() => {
    const printers = printersQuery.data ?? [];
    const currentDefault =
      settingsQuery.data?.label_printer?.trim() ||
      settingsQuery.data?.default_printer?.trim();

    return Array.from(
      new Set([
        currentDefault || "",
        ...printers.map((printer) => printer.trim()).filter(Boolean),
      ]),
    ).filter(Boolean);
  }, [printersQuery.data, settingsQuery.data]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuantity(1);
    setShowName(true);
    setShowPrice(true);
    setShowShopName(false);
    setLabelSize("40x25");
  }, [item?.id, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const defaultPrinter =
      settingsQuery.data?.label_printer?.trim() ||
      settingsQuery.data?.default_printer?.trim() ||
      printersQuery.data?.[0]?.trim() ||
      "";

    setSelectedPrinter(defaultPrinter);
  }, [open, printersQuery.data, settingsQuery.data]);

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

  const handlePrint = async () => {
    if (!item || !hasBarcode) {
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
        {
          configs: [
            {
              itemId: item.id,
              quantity,
              showName,
              showPrice,
              showShopName,
              labelSize,
            },
          ],
        },
        { toast: false },
      );

      toast.success("جاري الطباعة...", {
        description: `${quantity} ${quantity === 1 ? "ملصق" : "ملصقات"} لـ ${item.name_ar}`,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(parseAppError(error).message_ar);
    } finally {
      setIsPrinting(false);
    }
  };

  const totalLabelText = quantity === 1 ? "ملصق" : "ملصقات";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl!" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>
            {item ? `طباعة باركود — ${item.name_ar}` : "طباعة باركود"}
          </DialogTitle>
          <DialogDescription>
            اختر إعدادات الملصق ثم أرسل الباركود إلى الطابعة المحددة.
          </DialogDescription>
        </DialogHeader>

        {!item ? (
          <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            جاري تحميل بيانات الصنف...
          </div>
        ) : !hasBarcode ? (
          <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-right text-amber-900">
            <p className="font-medium">
              هذا الصنف لا يحتوي على باركود — أضف باركود من تعديل الصنف أولاً
            </p>
            <div className="flex flex-wrap justify-start gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onEditItem?.();
                }}
              >
                <Pencil />
                تعديل الصنف
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-5 shadow-sm">
                <p className="text-sm text-muted-foreground">الباركود الحالي</p>
                <p className="mt-3 text-center font-mono text-2xl tracking-[0.35em] sm:text-[2rem]">
                  {barcode}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <ControlCard title="عدد النسخ">
                  <div className="flex flex-wrap gap-2">
                    {[1, 5, 10, 25, 50].map((value) => (
                      <Button
                        key={value}
                        type="button"
                        variant={quantity === value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setQuantity(value)}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                  <input
                    className="mt-3 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    type="number"
                    min={1}
                    max={100}
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(
                        Math.min(
                          100,
                          Math.max(1, Number(event.target.value) || 1),
                        ),
                      )
                    }
                  />
                </ControlCard>

                <ControlCard title="حجم الملصق">
                  <div className="space-y-3">
                    {LABEL_SIZE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors hover:bg-muted/40"
                      >
                        <input
                          type="radio"
                          name="label-size"
                          checked={labelSize === option.value}
                          onChange={() => setLabelSize(option.value)}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </ControlCard>
              </div>

              <ControlCard title="محتوى الملصق">
                <div className="grid gap-3 sm:grid-cols-3">
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
              </ControlCard>

              <ControlCard title="الطابعة">
                <div className="space-y-2">
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
                  <p className="text-xs text-muted-foreground">
                    سيتم حفظ الاختيار كطابعة الملصقات المستخدمة لاحقاً.
                  </p>
                </div>
              </ControlCard>
            </div>

            <div className="space-y-3 xl:sticky xl:top-0">
              <div className="rounded-2xl border bg-muted/30 p-4 shadow-sm xl:min-h-full">
                <p className="mb-3 text-sm font-medium text-muted-foreground">
                  المعاينة الحية
                </p>
                <LabelPreview
                  item={item}
                  barcode={barcode}
                  labelSize={labelSize}
                  showName={showName}
                  showPrice={showPrice}
                  showShopName={showShopName}
                  shopName={shopName}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-row-reverse justify-start gap-2 bg-transparent p-0 pt-2">
          <Button
            type="button"
            className="min-w-32"
            disabled={!item || !hasBarcode || isPrinting}
            onClick={handlePrint}
          >
            {isPrinting ? <Loader2 className="animate-spin" /> : <Printer />}
            طباعة {quantity} {totalLabelText}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPrinting}
          >
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
    <label className="flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors hover:bg-muted/40">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function LabelPreview({
  item,
  barcode,
  labelSize,
  showName,
  showPrice,
  showShopName,
  shopName,
}: {
  item: Item;
  barcode: string;
  labelSize: LabelSize;
  showName: boolean;
  showPrice: boolean;
  showShopName: boolean;
  shopName: string;
}) {
  const sizeClass =
    labelSize === "30x20"
      ? "max-w-48"
      : labelSize === "50x30"
        ? "max-w-64"
        : "max-w-56";

  return (
    <div
      className={`mx-auto flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed bg-background px-4 py-5 text-center ${sizeClass}`}
    >
      {showShopName ? (
        <p className="text-[11px] font-medium">{shopName}</p>
      ) : null}
      <div className="w-full overflow-hidden rounded-xl bg-white px-2 py-2 shadow-inner">
        <Barcode
          value={barcode}
          format="CODE128"
          width={2}
          height={60}
          displayValue={false}
        />
      </div>
      <p className="font-mono text-sm tracking-[0.3em]">{barcode}</p>
      {showName ? (
        <p className="text-sm font-medium leading-snug">{item.name_ar}</p>
      ) : null}
      {showPrice ? (
        <p className="text-sm text-muted-foreground">
          {formatEGP(item.sell_price_millieme)}
        </p>
      ) : null}
    </div>
  );
}
