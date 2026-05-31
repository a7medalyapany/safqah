import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "@/app/layout";
import { RouteFallback } from "@/app/routing/RouteFallback";
import {
  FeatureRoute,
  ProtectedPosRoute,
  RequireAuth,
} from "@/app/routing/guards";

const DashboardPage = lazy(() => import("@/modules/dashboard"));
const ItemsPage = lazy(() => import("@/modules/items"));
const SalesPage = lazy(() => import("@/modules/sales"));
const PurchasesPage = lazy(() => import("@/modules/purchases"));
const CustomersPage = lazy(() => import("@/modules/customers"));
const SuppliersPage = lazy(() => import("@/modules/suppliers"));
const FinancePage = lazy(() => import("@/modules/finance"));
const ReportsPage = lazy(() => import("@/modules/reports"));
const SettingsPage = lazy(() => import("@/modules/settings"));

function lazyRoute(node: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{node}</Suspense>;
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
        element: lazyRoute(<DashboardPage />),
      },
      {
        path: "pos",
        element: <ProtectedPosRoute />,
      },
      {
        path: "items",
        element: lazyRoute(<ItemsPage />),
      },
      {
        path: "sales",
        element: lazyRoute(<SalesPage />),
      },
      {
        path: "purchases",
        element: lazyRoute(
          <FeatureRoute feature="purchases">
            <PurchasesPage />
          </FeatureRoute>,
        ),
      },
      {
        path: "customers",
        element: lazyRoute(<CustomersPage />),
      },
      {
        path: "suppliers",
        element: lazyRoute(<SuppliersPage />),
      },
      {
        path: "finance",
        element: lazyRoute(
          <FeatureRoute feature="finance">
            <FinancePage />
          </FeatureRoute>,
        ),
      },
      {
        path: "reports",
        element: lazyRoute(
          <FeatureRoute feature="reports">
            <ReportsPage />
          </FeatureRoute>,
        ),
      },
      {
        path: "settings",
        element: lazyRoute(
          <FeatureRoute feature="settings">
            <SettingsPage />
          </FeatureRoute>,
        ),
      },
    ],
  },
]);
