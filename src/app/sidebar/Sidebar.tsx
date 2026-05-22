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

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
  end?: boolean;
};

const navItems: NavItem[] = [
  { to: "/", label: "لوحة التحكم", icon: LayoutDashboard, end: true },
  { to: "/pos", label: "نقطة البيع", icon: ShoppingCart, primary: true },
  { to: "/items", label: "الأصناف", icon: Package },
  { to: "/sales", label: "المبيعات", icon: Receipt },
  { to: "/purchases", label: "المشتريات", icon: Truck },
  { to: "/customers", label: "العملاء", icon: Users },
  { to: "/suppliers", label: "الموردين", icon: Building },
  { to: "/finance", label: "المالية", icon: Wallet },
  { to: "/reports", label: "التقارير", icon: BarChart3 },
  { to: "/settings", label: "الإعدادات", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 right-0 z-20 flex w-[240px] flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-6 py-6">
        <h1 className="text-xl font-semibold tracking-tight">نظام نقطة البيع</h1>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
        {navItems.map(({ to, label, icon: Icon, primary, end }) => (
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
        <p className="text-sm font-medium">مستخدم النظام</p>
        <p className="mt-1 text-xs text-muted-foreground">الفرع الرئيسي</p>
      </div>
    </aside>
  );
}
