import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function CategoryTab({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button variant={active ? "default" : "outline"} onClick={onClick}>
      {children}
    </Button>
  );
}

export function PaymentTab({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      className={cn("flex-1", !active && "bg-background")}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function TableHead({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-3 py-2.5 align-middle", className)}>{children}</td>
  );
}

export function LoadingItemGrid() {
  return (
    <div>
      <div className="flex items-center gap-3 border-b border-border bg-muted/80 px-3 py-2.5">
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="hidden h-4 w-32 sm:block" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>
      {Array.from({ length: 10 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-border/60 px-3 py-3"
        >
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="hidden h-5 w-32 sm:block" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-28" />
        </div>
      ))}
    </div>
  );
}
