import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function TableHeadCell({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 text-right font-medium">{children}</th>;
}

export function TableCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>
  );
}

export function LoadingRows({
  rows = 6,
  columns,
}: {
  rows?: number;
  columns: number;
}) {
  return Array.from({ length: rows }).map((_, rowIndex) => (
    <tr key={rowIndex} className="border-t">
      {Array.from({ length: columns }).map((__, cellIndex) => (
        <td key={cellIndex} className="px-4 py-3">
          <Skeleton className="h-5 w-full max-w-24" />
        </td>
      ))}
    </tr>
  ));
}

export function EmptyState({
  colSpan,
  icon,
  label,
}: {
  colSpan: number;
  icon?: ReactNode;
  label: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-16">
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          {icon}
          <p className="text-base font-medium">{label}</p>
        </div>
      </td>
    </tr>
  );
}
