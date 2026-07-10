import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TableCell, TableHead } from "@/modules/pos/components/PosControls";
import { moneyToInput } from "@/modules/pos/utils";
import { formatEGP, toMillieme } from "@/shared/utils/money";
import type { CartItem } from "@/store/cartSlice";
import { toast } from "sonner";

// Compact, centered numeric input used across the cart rows. Native spin
// buttons are hidden so the cells stay clean and consistent.
const NUMBER_INPUT_CLASS =
  "h-9 w-16 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export function CartTable({
  items,
  onUpdateQty,
  onUpdateLineDiscountPercent,
  onUpdateLineUnitPrice,
  onRemoveItem,
}: {
  items: CartItem[];
  onUpdateQty: (itemId: number, qty: number) => void;
  onUpdateLineDiscountPercent: (
    itemId: number,
    discountPercent: number,
  ) => void;
  onUpdateLineUnitPrice: (itemId: number, unitPriceMillieme: number) => void;
  onRemoveItem: (itemId: number) => void;
}) {
  const commitLineUnitPrice = (
    item: CartItem,
    rawValue: string,
    input: HTMLInputElement,
  ) => {
    try {
      const nextUnitPriceMillieme = toMillieme(rawValue || 0);

      if (nextUnitPriceMillieme < item.buyPriceMillieme) {
        toast.error("لا يمكن البيع بأقل من سعر التكلفة");
        onUpdateLineUnitPrice(item.itemId, item.unitPriceMillieme);
        input.value = moneyToInput(item.unitPriceMillieme);
        return;
      }

      onUpdateLineUnitPrice(item.itemId, nextUnitPriceMillieme);
    } catch {
      onUpdateLineUnitPrice(item.itemId, item.unitPriceMillieme);
      input.value = moneyToInput(item.unitPriceMillieme);
      toast.error("سعر البيع غير صحيح");
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border">
      <div className="h-full overflow-auto">
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-muted-foreground">
            لا توجد أصناف — ابدأ بإضافة أصناف
          </div>
        ) : (
          <table className="w-full border-separate border-spacing-0 text-right text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted/80 backdrop-blur [&>th]:border-b [&>th]:border-border">
                <TableHead className="w-auto">الصنف</TableHead>
                <TableHead className="w-[4.5rem] text-center">الكمية</TableHead>
                <TableHead className="w-24 text-center">السعر</TableHead>
                <TableHead className="w-[4.5rem] text-center">الخصم %</TableHead>
                <TableHead className="w-28 text-center">الإجمالي</TableHead>
                <TableHead className="w-10 text-center">
                  <span className="sr-only">حذف</span>
                </TableHead>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.itemId}
                  className="group transition-colors hover:bg-muted/40 [&>td]:border-b [&>td]:border-border/60"
                >
                  <TableCell className="font-medium">
                    <span
                      className="block max-w-[10rem] truncate"
                      title={item.nameAr}
                    >
                      {item.nameAr}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      dir="rtl"
                      type="number"
                      min={1}
                      step="1"
                      className={NUMBER_INPUT_CLASS}
                      value={String(item.qty)}
                      onChange={(event) =>
                        onUpdateQty(
                          item.itemId,
                          Number(event.target.value) || 0,
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      key={`${item.itemId}-${item.unitPriceMillieme}`}
                      dir="rtl"
                      type="number"
                      min={0}
                      step="0.001"
                      className={cn(NUMBER_INPUT_CLASS, "w-20")}
                      defaultValue={moneyToInput(item.unitPriceMillieme)}
                      onBlur={(event) => {
                        commitLineUnitPrice(
                          item,
                          event.target.value,
                          event.target,
                        );
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") {
                          return;
                        }

                        event.preventDefault();
                        commitLineUnitPrice(
                          item,
                          event.currentTarget.value,
                          event.currentTarget,
                        );
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      key={`${item.itemId}-${item.discountPercent}`}
                      dir="rtl"
                      type="number"
                      min={0}
                      max={100}
                      step="1"
                      className={NUMBER_INPUT_CLASS}
                      defaultValue={String(item.discountPercent)}
                      onBlur={(event) => {
                        try {
                          const nextDiscountPercent = Math.max(
                            0,
                            Math.min(
                              100,
                              Math.trunc(Number(event.target.value) || 0),
                            ),
                          );

                          const nextTotalMillieme = Math.trunc(
                            item.unitPriceMillieme *
                              item.qty *
                              (1 - nextDiscountPercent / 100),
                          );

                          if (
                            nextTotalMillieme <
                            item.buyPriceMillieme * item.qty
                          ) {
                            toast.error("الخصم يجعل السعر أقل من سعر التكلفة");
                            onUpdateLineDiscountPercent(
                              item.itemId,
                              item.discountPercent,
                            );
                            event.target.value = String(item.discountPercent);
                            return;
                          }

                          onUpdateLineDiscountPercent(
                            item.itemId,
                            nextDiscountPercent,
                          );
                        } catch {
                          onUpdateLineDiscountPercent(item.itemId, 0);
                          event.target.value = "0";
                          toast.error("قيمة الخصم غير صحيحة");
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center font-semibold tabular-nums whitespace-nowrap">
                    {formatEGP(item.totalMillieme)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground opacity-70 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      onClick={() => onRemoveItem(item.itemId)}
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
  );
}
