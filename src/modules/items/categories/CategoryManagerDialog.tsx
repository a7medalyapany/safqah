import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Category } from "@/modules/items/types";
import { parseAppError } from "@/modules/items/utils";

type CategoryManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CategoryManagerDialog({
  open,
  onOpenChange,
}: CategoryManagerDialogProps) {
  const queryClient = useQueryClient();
  const [nameAr, setNameAr] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => invoke<Category[]>("list_categories"),
    staleTime: 30 * 1000,
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmed = nameAr.trim();
      if (!trimmed) {
        throw new Error("اسم الفئة مطلوب");
      }

      return invoke<Category>("create_category", { nameAr: trimmed });
    },
    onSuccess: async () => {
      setNameAr("");
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("تمت إضافة التصنيف بنجاح");
    },
    onError: (error) => {
      const appError = parseAppError(error);
      toast.error(
        appError.message_en === "اسم الفئة مطلوب"
          ? "اسم الفئة مطلوب"
          : appError.message_ar,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => invoke<boolean>("delete_category", { id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("تم حذف التصنيف بنجاح");
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!nameAr.trim()) {
      toast.error("اسم الفئة مطلوب");
      return;
    }

    createMutation.mutate();
  };

  const categories = categoriesQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>إدارة التصنيفات</DialogTitle>
          <DialogDescription>
            أضف التصنيفات الجديدة أو احذف التصنيفات غير المستخدمة.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <Input
              dir="rtl"
              placeholder="اسم التصنيف..."
              value={nameAr}
              onChange={(event) => setNameAr(event.target.value)}
              disabled={createMutation.isPending}
            />
            <Button type="submit" className="sm:min-w-28" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              إضافة
            </Button>
          </div>

          <div className="rounded-xl border">
            <div className="border-b px-4 py-3 text-right text-sm font-medium">
              التصنيفات الحالية
            </div>
            <div className="max-h-80 overflow-y-auto">
              {categoriesQuery.isLoading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                  ))}
                </div>
              ) : categories.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  لا توجد تصنيفات
                </div>
              ) : (
                <ul className="divide-y">
                  {categories.map((category) => (
                    <li
                      key={category.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(category.id)}
                        disabled={deleteMutation.isPending}
                        aria-label="حذف التصنيف"
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Trash2 />
                        )}
                      </Button>
                      <div className="flex-1 text-right font-medium">{category.name_ar}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter className="flex-row-reverse justify-start gap-2 bg-transparent p-0 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
