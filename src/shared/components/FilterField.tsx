import type { ReactNode } from "react";

export function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2 text-right text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}
