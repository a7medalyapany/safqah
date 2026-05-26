import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SectionCardProps = {
  title: string;
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
  withHeaderBorder?: boolean;
  children: ReactNode;
};

export function SectionCard({
  title,
  action,
  className,
  contentClassName,
  withHeaderBorder = false,
  children,
}: SectionCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader
        className={cn(
          "flex flex-row items-center justify-between gap-3",
          withHeaderBorder && "border-b",
        )}
      >
        <CardTitle className="text-lg">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
