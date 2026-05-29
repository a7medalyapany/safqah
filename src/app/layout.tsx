import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Outlet, useLocation } from "react-router-dom";
import { toast } from "sonner";

import { ErrorBoundary } from "@/app/ErrorBoundary";
import { Sidebar } from "@/app/sidebar/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseAppError } from "@/modules/items/utils";
import { CloseSessionDialog } from "@/modules/sessions/CloseSessionDialog";
import { OpenSessionDialog } from "@/modules/sessions/OpenSessionDialog";
import { type SessionState, useSessionStore } from "@/store/sessionSlice";

const SIDEBAR_WIDTH = 240;

export function AppLayout() {
  const location = useLocation();
  const activeSession = useSessionStore(
    (state: SessionState) => state.activeSession,
  );
  const fetchActiveSession = useSessionStore(
    (state: SessionState) => state.fetchActiveSession,
  );
  const [isOpenDialogVisible, setIsOpenDialogVisible] = useState(false);
  const [isCloseDialogVisible, setIsCloseDialogVisible] = useState(false);

  useEffect(() => {
    void fetchActiveSession().catch((error: unknown) => {
      toast.error(parseAppError(error).message_ar);
    });
  }, [fetchActiveSession]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen("print_failed", () => {
      toast.error("فشلت الطباعة — تأكد من اتصال الطابعة");
    }).then((unsubscribe) => {
      unlisten = unsubscribe;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  const cashierName = activeSession
    ? `الكاشير ${activeSession.cashier_id}`
    : null;
  const currentDate = new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />

      <main
        className="min-h-screen"
        style={{ marginRight: `${SIDEBAR_WIDTH}px` }}
      >
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">إدارة الجلسة الحالية</p>
              <p className="text-sm text-muted-foreground">{currentDate}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeSession ? (
                <>
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                    وردية مفتوحة
                  </Badge>
                  <Badge variant="outline">{cashierName}</Badge>
                  <Button onClick={() => setIsCloseDialogVisible(true)}>
                    إغلاق الوردية
                  </Button>
                </>
              ) : (
                <>
                  <Badge variant="destructive">لا توجد وردية</Badge>
                  <Button onClick={() => setIsOpenDialogVisible(true)}>
                    بدء الوردية
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>

      <OpenSessionDialog
        open={isOpenDialogVisible}
        onOpenChange={setIsOpenDialogVisible}
      />
      <CloseSessionDialog
        open={isCloseDialogVisible}
        onOpenChange={setIsCloseDialogVisible}
        session={activeSession}
      />
    </div>
  );
}
