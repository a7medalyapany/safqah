import {
  FilePlus2,
  PackagePlus,
  Receipt,
  TrendingDown,
  UserPlus,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function QuickActions({ onAddItem }: { onAddItem: () => void }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">إجراءات سريعة</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <QuickAction to="/pos" icon={<Receipt />}>
          فاتورة جديدة
        </QuickAction>
        <QuickAction icon={<PackagePlus />} onClick={onAddItem}>
          إضافة صنف
        </QuickAction>
        <QuickAction to="/purchases" icon={<FilePlus2 />}>
          فاتورة شراء
        </QuickAction>
        <QuickAction to="/customers" icon={<UserPlus />}>
          عميل جديد
        </QuickAction>
        <QuickAction to="/finance" icon={<Wallet />}>
          سند قبض
        </QuickAction>
        <QuickAction to="/finance" icon={<TrendingDown />}>
          سند صرف
        </QuickAction>
      </div>
    </section>
  );
}

function QuickAction({
  to,
  onClick,
  icon,
  children,
}: {
  to?: string;
  onClick?: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  const content = (
    <>
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
        {icon}
      </span>
      <span className="font-medium">{children}</span>
    </>
  );

  if (to) {
    return (
      <Button variant="outline" className="h-14 justify-start gap-3" asChild>
        <Link to={to}>{content}</Link>
      </Button>
    );
  }

  return (
    <Button variant="outline" className="h-14 justify-start gap-3" onClick={onClick}>
      {content}
    </Button>
  );
}
