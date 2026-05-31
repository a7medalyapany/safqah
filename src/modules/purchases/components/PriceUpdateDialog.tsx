import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseAppError } from "@/modules/items/utils";
import type { PriceSuggestion } from "@/modules/purchases/types";
import { invoke } from "@/shared/utils/invoke";
import { formatEGP } from "@/shared/utils/money";

export function PriceUpdateDialog({
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
          invoke(
            "update_item",
            {
              id: item.itemId,
              payload: {
                sell_price_millieme: item.suggestedSellPriceMillieme,
              },
            },
            { toast: false },
          ),
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
