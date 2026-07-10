import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "@/app/layout";
import { LazyRoute } from "@/app/routing/LazyRoute";
import {
  FeatureRoute,
  ProtectedPosRoute,
  RequireAuth,
} from "@/app/routing/guards";

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
        element: <LazyRoute loader={() => import("@/modules/dashboard")} />,
      },
      {
        path: "pos",
        element: <ProtectedPosRoute />,
      },
      {
        path: "items",
        element: <LazyRoute loader={() => import("@/modules/items")} />,
      },
      {
        path: "sales",
        element: <LazyRoute loader={() => import("@/modules/sales")} />,
      },
      {
        path: "purchases",
        element: (
          <FeatureRoute feature="purchases">
            <LazyRoute loader={() => import("@/modules/purchases")} />
          </FeatureRoute>
        ),
      },
      {
        path: "customers",
        element: <LazyRoute loader={() => import("@/modules/customers")} />,
      },
      {
        path: "suppliers",
        element: <LazyRoute loader={() => import("@/modules/suppliers")} />,
      },
      {
        path: "finance",
        element: (
          <FeatureRoute feature="finance">
            <LazyRoute loader={() => import("@/modules/finance")} />
          </FeatureRoute>
        ),
      },
      {
        path: "reports",
        element: (
          <FeatureRoute feature="reports">
            <LazyRoute loader={() => import("@/modules/reports")} />
          </FeatureRoute>
        ),
      },
      {
        path: "settings",
        element: (
          <FeatureRoute feature="settings">
            <LazyRoute loader={() => import("@/modules/settings")} />
          </FeatureRoute>
        ),
      },
    ],
  },
]);
