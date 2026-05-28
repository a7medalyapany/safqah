import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { Download, Loader2, RotateCcw } from "lucide-react";
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
import { parseAppError } from "@/modules/items/utils";
import { SectionCard } from "@/shared/components/SectionCard";

type BackupInfo = {
  filename: string;
  path: string;
  size_bytes: number;
  created_at: string;
};

const backupDateFormatter = new Intl.DateTimeFormat("ar-EG", {
  dateStyle: "medium",
  timeStyle: "short",
});

const sizeFormatter = new Intl.NumberFormat("ar-EG", {
  maximumFractionDigits: 1,
});

export function BackupSection() {
  const queryClient = useQueryClient();
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);

  const backupsQuery = useQuery({
    queryKey: ["backups"],
    queryFn: () => invoke<BackupInfo[]>("list_backups"),
  });

  useEffect(() => {
    if (backupsQuery.error) {
      toast.error(parseAppError(backupsQuery.error).message_ar);
    }
  }, [backupsQuery.error]);

  const backupMutation = useMutation({
    mutationFn: () => invoke<BackupInfo>("trigger_backup"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["backups"] });
      toast.success("تم إنشاء نسخة احتياطية بنجاح");
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (backup: BackupInfo) => {
      const restored = await invoke<boolean>("restore_backup", {
        backupPath: backup.path,
      });

      if (!restored) {
        throw new Error("Restore failed");
      }

      await relaunch();
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

  const backups = backupsQuery.data ?? [];

  return (
    <>
      <SectionCard
        title="النسخ الاحتياطي"
        action={
          <Button
            onClick={() => backupMutation.mutate()}
            disabled={backupMutation.isPending}
          >
            {backupMutation.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Download />
            )}
            نسخ احتياطي الآن
          </Button>
        }
        withHeaderBorder
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-right">
            <thead>
              <tr className="text-sm text-muted-foreground">
                <th className="border-b px-4 py-3 font-medium">اسم الملف</th>
                <th className="border-b px-4 py-3 font-medium">الحجم</th>
                <th className="border-b px-4 py-3 font-medium">التاريخ</th>
                <th className="border-b px-4 py-3 font-medium">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {backupsQuery.isLoading ? (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-muted-foreground"
                    colSpan={4}
                  >
                    جاري تحميل النسخ الاحتياطية...
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-muted-foreground"
                    colSpan={4}
                  >
                    لا توجد نسخ احتياطية بعد.
                  </td>
                </tr>
              ) : (
                backups.map((backup) => (
                  <tr key={backup.path} className="border-b last:border-b-0">
                    <td className="px-4 py-4 font-medium">{backup.filename}</td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {formatBytes(backup.size_bytes)}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {backupDateFormatter.format(new Date(backup.created_at))}
                    </td>
                    <td className="px-4 py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedBackup(backup)}
                        disabled={restoreMutation.isPending}
                      >
                        <RotateCcw />
                        استعادة
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <RestoreConfirmDialog
        backup={selectedBackup}
        open={Boolean(selectedBackup)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedBackup(null);
          }
        }}
        onConfirm={async () => {
          if (!selectedBackup) {
            return;
          }

          await restoreMutation.mutateAsync(selectedBackup);
          setSelectedBackup(null);
        }}
        isSubmitting={restoreMutation.isPending}
      />
    </>
  );
}

type RestoreConfirmDialogProps = {
  open: boolean;
  backup: BackupInfo | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  isSubmitting: boolean;
};

function RestoreConfirmDialog({
  open,
  backup,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: RestoreConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="text-right">
          <DialogTitle>استعادة نسخة احتياطية</DialogTitle>
          <DialogDescription className="space-y-2 text-right">
            <p>
              ⚠️ تحذير: سيتم استبدال بيانات البرنامج الحالية بالنسخة الاحتياطية
              المختارة.
            </p>
            <p>سيتم إغلاق البرنامج وإعادة تشغيله تلقائياً.</p>
            <p>
              تاريخ النسخة:{" "}
              {backup
                ? backupDateFormatter.format(new Date(backup.created_at))
                : "-"}
            </p>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-row-reverse justify-start gap-2 bg-transparent p-0 pt-2">
          <Button
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={isSubmitting || !backup}
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : null}
            استعادة
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${sizeFormatter.format(value)} ${units[unitIndex]}`;
}
