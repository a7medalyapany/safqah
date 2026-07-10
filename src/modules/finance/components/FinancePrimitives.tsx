import { Receipt } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function SummaryCard({
  title,
  value,
  tone,
  isLoading,
}: {
  title: string;
  value: string;
  tone: "green" | "red" | "orange" | "blue";
  isLoading: boolean;
}) {
  const tones: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <Card className={cn("border", tones[tone])}>
      <CardContent className="space-y-1 p-4 text-center">
        <p className="text-xs font-medium opacity-80">{title}</p>
        <p className="text-xl font-bold">{isLoading ? "..." : value}</p>
      </CardContent>
    </Card>
  );
}

// Re-exported from the shared table primitives (single source of truth).
export { TableCell, TableHeadCell as TableHead } from "@/shared/components/DataTable";

export function LoadingRows({ cols }: { cols: number }) {
  return Array.from({ length: 5 }).map((_, index) => (
    <tr key={index} className="border-t">
      {Array.from({ length: cols }).map((__, cellIndex) => (
        <td key={cellIndex} className="px-4 py-3">
          <Skeleton className="h-5 w-full max-w-24" />
        </td>
      ))}
    </tr>
  ));
}

export function EmptyState({
  colSpan,
  message,
}: {
  colSpan: number;
  message: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-16">
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <Receipt className="size-10 text-muted-foreground" />
          <p className="text-base font-medium">{message}</p>
        </div>
      </td>
    </tr>
  );
}
