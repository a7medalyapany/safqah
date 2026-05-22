import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "@/app/layout";
import PosPage from "@/modules/pos";

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

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: withSuspense(<DashboardPage />),
      },
      {
        path: "pos",
        element: <PosPage />,
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
        element: withSuspense(<PurchasesPage />),
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
        element: withSuspense(<FinancePage />),
      },
      {
        path: "reports",
        element: withSuspense(<ReportsPage />),
      },
      {
        path: "settings",
        element: withSuspense(<SettingsPage />),
      },
    ],
  },
]);
