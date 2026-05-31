import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableHead } from "@/modules/pos/components/PosControls";
import { moneyToInput } from "@/modules/pos/utils";
import { formatEGP, toMillieme } from "@/shared/utils/money";
import type { CartItem } from "@/store/cartSlice";
import { toast } from "sonner";

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
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border">
      <div className="h-full overflow-auto">
        {items.length === 0 ? (
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
                <TableHead>الخصم %</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>×</TableHead>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.itemId} className="border-t align-top">
                  <TableCell className="font-medium">{item.nameAr}</TableCell>
                  <TableCell>
                    <Input
                      dir="rtl"
                      type="number"
                      min={1}
                      step="1"
                      className="w-20 text-center"
                      value={String(item.qty)}
                      onChange={(event) =>
                        onUpdateQty(
                          item.itemId,
                          Number(event.target.value) || 0,
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      key={`${item.itemId}-${item.unitPriceMillieme}`}
                      dir="rtl"
                      type="number"
                      min={0}
                      step="0.001"
                      className="w-28 text-center"
                      defaultValue={moneyToInput(item.unitPriceMillieme)}
                      onBlur={(event) => {
                        try {
                          const nextUnitPriceMillieme = toMillieme(
                            event.target.value || 0,
                          );

                          if (nextUnitPriceMillieme < item.buyPriceMillieme) {
                            toast.error("لا يمكن البيع بأقل من سعر التكلفة");
                            onUpdateLineUnitPrice(
                              item.itemId,
                              item.unitPriceMillieme,
                            );
                            event.target.value = moneyToInput(
                              item.unitPriceMillieme,
                            );
                            return;
                          }

                          onUpdateLineUnitPrice(
                            item.itemId,
                            nextUnitPriceMillieme,
                          );
                        } catch {
                          onUpdateLineUnitPrice(
                            item.itemId,
                            item.unitPriceMillieme,
                          );
                          event.target.value = moneyToInput(
                            item.unitPriceMillieme,
                          );
                          toast.error("سعر البيع غير صحيح");
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      key={`${item.itemId}-${item.discountPercent}`}
                      dir="rtl"
                      type="number"
                      min={0}
                      max={100}
                      step="1"
                      className="w-24 text-center"
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
                  <TableCell className="font-semibold">
                    {formatEGP(item.totalMillieme)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
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
