import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { statusLabels } from "@/modules/purchases/constants";
import type { PurchaseStatus } from "@/modules/purchases/types";
import { getStatusTone } from "@/modules/purchases/utils";

export function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: ReactNode;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0">
        <div className="rounded-xl bg-primary/8 p-2 text-primary">{icon}</div>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-right">
        <p className="text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

export function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  min?: string;
  step?: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input
        type={type}
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function StatusBadge({ status }: { status: PurchaseStatus }) {
  return (
    <Badge variant="outline" className={cn(getStatusTone(status))}>
      {statusLabels[status] ?? status}
    </Badge>
  );
}

export function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        strong && "text-base font-semibold",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function LoadingRows({ columns }: { columns: number }) {
  return Array.from({ length: 6 }).map((_, index) => (
    <tr key={index} className="border-t">
      {Array.from({ length: columns }).map((__, cellIndex) => (
        <td key={cellIndex} className="px-4 py-3">
          <Skeleton className="h-5 w-full max-w-24" />
        </td>
      ))}
    </tr>
  ));
}

// Re-exported from the shared table primitives (single source of truth).
export { TableCell, TableHeadCell as TableHead } from "@/shared/components/DataTable";
