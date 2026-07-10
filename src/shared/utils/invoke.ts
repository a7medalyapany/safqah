import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import type { AppErrorShape } from "@/shared/types/errors";

type BackendAppErrorShape = {
  code: string;
  message_ar: string;
  message_en: string;
};

const IPC_FAILURE_MESSAGE = "تعذر الاتصال بالنظام — يرجى إعادة تشغيل البرنامج";

const TOKEN_STORAGE_KEY = "safqah.auth.token";

// Every backend command (outside the login/setup flow) verifies the session
// token and the caller's role — route guards in the UI are convenience only.
// Injecting the token here keeps call sites unchanged; commands that do not
// declare a `token` argument simply ignore it.
function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

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
    const token = readStoredToken();
    return await tauriInvoke<T>(command, token ? { token, ...args } : args);
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
