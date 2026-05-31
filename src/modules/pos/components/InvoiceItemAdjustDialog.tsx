import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Item } from "@/modules/items/types";
import { moneyToInput } from "@/modules/pos/utils";
import { formatEGP, toMillieme } from "@/shared/utils/money";
import { toast } from "sonner";

export function InvoiceItemAdjustDialog({
  open,
  item,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  item: Item | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (params: {
    unitPriceMillieme: number;
    discountPercent: number;
  }) => void;
}) {
  const [unitPrice, setUnitPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState("0");

  useEffect(() => {
    if (!open || !item) {
      return;
    }

    setUnitPrice(moneyToInput(item.sell_price_millieme));
    setDiscountPercent("0");
  }, [item, open]);

  const handleSave = () => {
    if (!item) {
      return;
    }

    let unitPriceMillieme: number;
    let discountPercentValue: number;

    try {
      unitPriceMillieme = toMillieme(unitPrice);
    } catch {
      setUnitPrice(moneyToInput(item.sell_price_millieme));
      toast.error("سعر البيع غير صحيح");
      return;
    }

    discountPercentValue = Math.max(
      0,
      Math.min(100, Math.trunc(Number(discountPercent) || 0)),
    );

    if (unitPriceMillieme < item.buy_price_millieme) {
      toast.error("لا يمكن البيع بأقل من سعر التكلفة");
      setUnitPrice(moneyToInput(item.buy_price_millieme));
      return;
    }

    const discountMillieme = Math.trunc(
      (unitPriceMillieme * discountPercentValue) / 100,
    );
    if (unitPriceMillieme - discountMillieme < item.buy_price_millieme) {
      toast.error("الخصم يجعل السعر أقل من سعر التكلفة");
      return;
    }

    onConfirm({
      unitPriceMillieme,
      discountPercent: discountPercentValue,
    });
    onOpenChange(false);
  };

  const finalUnitPrice = (() => {
    try {
      const parsedUnitPrice = toMillieme(unitPrice);
      const parsedDiscountPercent = Math.max(
        0,
        Math.min(100, Math.trunc(Number(discountPercent) || 0)),
      );
      return Math.max(
        0,
        parsedUnitPrice -
          Math.trunc((parsedUnitPrice * parsedDiscountPercent) / 100),
      );
    } catch {
      return item?.sell_price_millieme ?? 0;
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>تعديل سعر الفاتورة</DialogTitle>
          <DialogDescription>
            غيّر سعر البيع أو الخصم لهذه الفاتورة فقط، مع منع النزول تحت سعر
            التكلفة.
          </DialogDescription>
        </DialogHeader>

        {item ? (
          <div className="space-y-4 text-right">
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">الصنف</span>
                <span className="font-medium">{item.name_ar}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">سعر التكلفة</span>
                <span className="font-medium">
                  {formatEGP(item.buy_price_millieme)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">السعر الافتراضي</span>
                <span className="font-medium">
                  {formatEGP(item.sell_price_millieme)}
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-right">
                <span className="text-sm font-medium">سعر البيع</span>
                <Input
                  dir="rtl"
                  type="number"
                  min={0}
                  step="0.001"
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                  placeholder="0"
                />
              </label>

              <label className="space-y-2 text-right">
                <span className="text-sm font-medium">الخصم %</span>
                <Input
                  dir="rtl"
                  type="number"
                  min={0}
                  max={100}
                  step="1"
                  value={discountPercent}
                  onChange={(event) => setDiscountPercent(event.target.value)}
                  placeholder="0"
                />
              </label>
            </div>

            <div className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
              السعر النهائي بعد الخصم: {formatEGP(finalUnitPrice)}
            </div>
          </div>
        ) : null}

        <DialogFooter className="flex-row-reverse gap-2 bg-transparent p-0 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={item === null}>
            حفظ في هذه الفاتورة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
