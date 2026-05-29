import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import type { AppErrorShape } from "@/modules/items/types";

type BackendAppErrorShape = {
  code: string;
  message_ar: string;
  message_en: string;
};

const IPC_FAILURE_MESSAGE = "تعذر الاتصال بالنظام — يرجى إعادة تشغيل البرنامج";

type InvokeOptions = {
  toast?: boolean;
};

function normalizeInvokeError(error: unknown): AppErrorShape {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "message_ar" in error &&
    "message_en" in error
  ) {
    const backendError = error as BackendAppErrorShape;

    return {
      code: backendError.code,
      message_ar: backendError.message_ar,
      debugMessage: backendError.message_en,
    };
  }

  if (typeof error === "string") {
    return {
      code: "IPC_ERROR",
      message_ar: IPC_FAILURE_MESSAGE,
      debugMessage: error,
    };
  }

  if (error instanceof Error) {
    return {
      code: "IPC_ERROR",
      message_ar: IPC_FAILURE_MESSAGE,
      debugMessage: error.message,
    };
  }

  return {
    code: "IPC_ERROR",
    message_ar: IPC_FAILURE_MESSAGE,
    debugMessage: "Unknown error",
  };
}

export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
  options: InvokeOptions = {},
): Promise<T> {
  try {
    return await tauriInvoke<T>(command, args);
  } catch (error: unknown) {
    const appError = normalizeInvokeError(error);

    if (appError.debugMessage) {
      console.error(`[${command}] ${appError.code}: ${appError.debugMessage}`);
    } else {
      console.error(`[${command}] Unknown error:`, error);
    }

    if (options.toast !== false) {
      toast.error(appError.message_ar);
    }

    throw appError;
  }
}
