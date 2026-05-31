import { useEffect, useRef, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

import { LoginPage } from "@/app/auth/LoginPage";
import { RouteFallback } from "@/app/routing/RouteFallback";
import PosPage from "@/modules/pos";
import { useAuthStore } from "@/store/authSlice";
import { type SessionState, useSessionStore } from "@/store/sessionSlice";

export function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

export function FeatureRoute({
  feature,
  children,
}: {
  feature: string;
  children: ReactNode;
}) {
  const canAccess = useAuthStore((state) => state.canAccess);

  if (!canAccess(feature)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

function AccessDenied() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-6">
      <p className="text-lg font-medium text-muted-foreground">
        ليس لديك صلاحية لهذه الصفحة
      </p>
    </div>
  );
}

export function ProtectedPosRoute() {
  const activeSession = useSessionStore(
    (state: SessionState) => state.activeSession,
  );
  const isLoading = useSessionStore((state: SessionState) => state.isLoading);
  const hasShownToastRef = useRef(false);

  useEffect(() => {
    if (!isLoading && !activeSession && !hasShownToastRef.current) {
      hasShownToastRef.current = true;
      toast.error("افتح وردية أولاً للبدء في البيع");
    }
  }, [activeSession, isLoading]);

  if (isLoading) {
    return <RouteFallback />;
  }

  if (!activeSession) {
    return <Navigate to="/" replace />;
  }

  return <PosPage />;
}
