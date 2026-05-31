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

export function TableHead({ children }: { children: ReactNode }) {
  return <th className="px-3 py-3 text-right font-medium">{children}</th>;
}

export function TableCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={cn("px-3 py-3", className)}>{children}</td>;
}

export function LoadingItemGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 9 }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-2xl border p-4">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-5 w-28" />
        </div>
      ))}
    </div>
  );
}
