import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getDbFileSize,
  listPrinters,
  vacuumDatabase,
} from "@/modules/settings/api";
import { settingsKeys } from "@/modules/settings/constants";
import { parseAppError } from "@/modules/items/utils";

export function usePrintersQuery() {
  return useQuery({
    queryKey: settingsKeys.printers,
    queryFn: listPrinters,
  });
}

export function useDbSizeQuery() {
  return useQuery({
    queryKey: settingsKeys.dbSize,
    queryFn: getDbFileSize,
    staleTime: 30 * 1000,
  });
}

export function useVacuumDatabaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: vacuumDatabase,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsKeys.dbSize });
      toast.success("تم تحسين قاعدة البيانات بنجاح");
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });
}
