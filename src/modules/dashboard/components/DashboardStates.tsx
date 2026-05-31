import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export function ChartSkeleton() {
  return <Skeleton className="h-[292px] w-full rounded-lg" />;
}

export function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-28" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex h-[292px] items-center justify-center rounded-lg border border-dashed text-sm font-medium text-muted-foreground ${className}`}
    >
      {children}
    </div>
  );
}

export function ErrorState() {
  return (
    <div className="flex h-[292px] items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 px-4 text-center text-sm font-medium text-destructive">
      تعذر تحميل البيانات الآن
    </div>
  );
}
