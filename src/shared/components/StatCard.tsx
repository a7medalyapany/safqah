import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const toneClasses = {
  default: "bg-primary/8 text-primary",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-destructive/10 text-destructive",
} as const;

export function StatCard({
  title,
  value,
  icon,
  tone = "default",
}: {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof toneClasses;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0">
        {icon ? (
          <div className={cn("rounded-xl p-2", toneClasses[tone])}>{icon}</div>
        ) : null}
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-right">
        <p className="text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
