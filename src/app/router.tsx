import { lazy, Suspense, type ReactNode, useEffect, useRef } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { toast } from "sonner";

import { LoginPage } from "@/app/auth/LoginPage";
import { AppLayout } from "@/app/layout";
import PosPage from "@/modules/pos";
import { type SessionState, useSessionStore } from "@/store/sessionSlice";
import { useAuthStore } from "@/store/authSlice";

const DashboardPage = lazy(() => import("@/modules/dashboard"));
const ItemsPage = lazy(() => import("@/modules/items"));
const SalesPage = lazy(() => import("@/modules/sales"));
const PurchasesPage = lazy(() => import("@/modules/purchases"));
const CustomersPage = lazy(() => import("@/modules/customers"));
const SuppliersPage = lazy(() => import("@/modules/suppliers"));
const FinancePage = lazy(() => import("@/modules/finance"));
const ReportsPage = lazy(() => import("@/modules/reports"));
const SettingsPage = lazy(() => import("@/modules/settings"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <p className="text-lg text-muted-foreground">جارٍ التحميل...</p>
    </div>
  );
}

function withSuspense(node: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{node}</Suspense>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

function FeatureRoute({
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

function ProtectedPosRoute() {
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

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: withSuspense(<DashboardPage />),
      },
      {
        path: "pos",
        element: <ProtectedPosRoute />,
      },
      {
        path: "items",
        element: withSuspense(<ItemsPage />),
      },
      {
        path: "sales",
        element: withSuspense(<SalesPage />),
      },
      {
        path: "purchases",
        element: withSuspense(
          <FeatureRoute feature="purchases">
            <PurchasesPage />
          </FeatureRoute>,
        ),
      },
      {
        path: "customers",
        element: withSuspense(<CustomersPage />),
      },
      {
        path: "suppliers",
        element: withSuspense(<SuppliersPage />),
      },
      {
        path: "finance",
        element: withSuspense(
          <FeatureRoute feature="finance">
            <FinancePage />
          </FeatureRoute>,
        ),
      },
      {
        path: "reports",
        element: withSuspense(
          <FeatureRoute feature="reports">
            <ReportsPage />
          </FeatureRoute>,
        ),
      },
      {
        path: "settings",
        element: withSuspense(
          <FeatureRoute feature="settings">
            <SettingsPage />
          </FeatureRoute>,
        ),
      },
    ],
  },
]);
