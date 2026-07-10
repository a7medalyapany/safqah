import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DraftPurchaseItem } from "@/modules/purchases/types";
import { calculateProfitMargin, formatDateOnly, formatMarginLabel, parseInteger, safeToMillieme } from "@/modules/purchases/utils";
import { formatEGP } from "@/shared/utils/money";

import { TableCell, TableHead } from "./PurchasePrimitives";

/** The per-line fields the user can edit directly in the table. */
export type EditablePurchaseItemField = "qty" | "unitCost" | "suggestedSellPrice";

export function SelectedPurchaseItemsTable({
  items,
  onUpdateField,
  onRemove,
}: {
  items: DraftPurchaseItem[];
  onUpdateField: (
    itemId: number,
    field: EditablePurchaseItemField,
    value: string,
  ) => void;
  onRemove: (itemId: number) => void;
}) {
  return (
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
          {items.length === 0 ? (
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
              {items.map((item) => {
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
                          onUpdateField(item.itemId, "qty", event.target.value)
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
                            onUpdateField(
                              item.itemId,
                              "unitCost",
                              event.target.value,
                            )
                          }
                        />

                        {item.lastPurchaseCostMillieme !== null ? (
                          unitCostMillieme > item.lastPurchaseCostMillieme ? (
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
                          onUpdateField(
                            item.itemId,
                            "suggestedSellPrice",
                            event.target.value,
                          )
                        }
                        placeholder="اختياري"
                      />
                    </TableCell>
                    <TableCell>
                      {formatEGP(unitCostMillieme * parseInteger(item.qty))}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onRemove(item.itemId)}
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
  );
}
