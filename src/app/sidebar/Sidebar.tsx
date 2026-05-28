import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authSlice";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
  end?: boolean;
  feature?: string;
};

const navItems: NavItem[] = [
  { to: "/", label: "لوحة التحكم", icon: LayoutDashboard, end: true },
  {
    to: "/pos",
    label: "نقطة البيع",
    icon: ShoppingCart,
    primary: true,
    feature: "pos",
  },
  { to: "/items", label: "الأصناف", icon: Package, feature: "items" },
  { to: "/sales", label: "المبيعات", icon: Receipt },
  { to: "/purchases", label: "المشتريات", icon: Truck, feature: "purchases" },
  { to: "/customers", label: "العملاء", icon: Users },
  { to: "/suppliers", label: "الموردين", icon: Building },
  { to: "/finance", label: "المالية", icon: Wallet, feature: "finance" },
  { to: "/reports", label: "التقارير", icon: BarChart3, feature: "reports" },
  { to: "/settings", label: "الإعدادات", icon: Settings, feature: "settings" },
];

export function Sidebar() {
  const canAccess = useAuthStore((state) => state.canAccess);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const visibleNavItems = navItems.filter(
    ({ feature }) => !feature || canAccess(feature),
  );

  return (
    <aside className="fixed inset-y-0 right-0 z-20 flex w-[240px] flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-6 py-6">
        <h1 className="text-xl font-semibold tracking-tight">
          نظام نقطة البيع
        </h1>
        {user ? (
          <p className="mt-2 text-xs text-sidebar-foreground/70">
            {user.name} ·{" "}
            {user.role === "admin"
              ? "مدير"
              : user.role === "cashier"
                ? "كاشير"
                : "محاسب"}
          </p>
        ) : null}
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
        {visibleNavItems.map(({ to, label, icon: Icon, primary, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                primary
                  ? "border-sidebar-primary/25 text-sidebar-primary hover:bg-sidebar-primary/8"
                  : "border-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive &&
                  (primary
                    ? "border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary"
                    : "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"),
              )
            }
          >
            <span>{label}</span>
            <Icon className="h-4 w-4 shrink-0" />
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-6 py-5">
        <p className="text-sm font-medium">{user?.name ?? "مستخدم النظام"}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {user?.username ?? "الفرع الرئيسي"}
        </p>
        <button
          type="button"
          className="mt-4 text-sm font-medium text-sidebar-primary transition-colors hover:text-sidebar-primary/80"
          onClick={logout}
        >
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
