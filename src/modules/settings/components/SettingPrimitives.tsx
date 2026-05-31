import type { HTMLInputTypeAttribute, ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ReceiptSize } from "@/modules/settings/useSettings";

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-row items-center justify-between gap-3 border-b px-6 py-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: HTMLInputTypeAttribute;
  className?: string;
}) {
  return (
    <label className={cn("space-y-2 text-right", className)}>
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <Input
        dir="rtl"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3 text-right">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-input accent-primary"
      />
    </label>
  );
}

export function ReceiptSizeOption({
  label,
  value,
  checked,
  onChange,
}: {
  label: string;
  value: ReceiptSize;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition-colors",
        checked
          ? "border-primary bg-primary/5"
          : "bg-background hover:bg-muted/40",
      )}
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type="radio"
        name="receipt-size"
        value={value}
        checked={checked}
        onChange={onChange}
      />
    </label>
  );
}

export function StatTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-dashed bg-muted/20">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-full bg-background p-2 text-muted-foreground">
          {icon}
        </div>
        <div className="space-y-1 text-right">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            {label}
          </p>
          <p className="text-sm font-medium text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
