import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Trash2 } from "lucide-react";
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
import type { Party, PartyKind } from "@/modules/parties/types";
import { getPartyMeta, parseAppError } from "@/modules/parties/utils";

type DeletePartyDialogProps = {
  kind: PartyKind;
  party: Party | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeletePartyDialog({
  kind,
  party,
  open,
  onOpenChange,
}: DeletePartyDialogProps) {
  const queryClient = useQueryClient();
  const meta = getPartyMeta(kind);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!party) {
        return false;
      }

      return invoke<boolean>(`delete_${kind}`, { id: party.id });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [kind] });
      toast.success(`تم حذف ${meta.singular} بنجاح`);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>{`هل أنت متأكد من حذف ${meta.singular}؟`}</DialogTitle>
          <DialogDescription>
            سيتم إخفاء السجل من القائمة الحالية بعد الحذف.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-row-reverse justify-start gap-2 bg-transparent p-0 pt-2">
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !party}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            حذف
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
