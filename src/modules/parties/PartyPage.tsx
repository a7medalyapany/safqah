import { useDeferredValue, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@/shared/utils/invoke";
import {
  BadgePlus,
  BookOpen,
  Edit3,
  Search,
  Trash2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerLedgerSheet } from "@/modules/parties/CustomerLedgerSheet";
import { DeletePartyDialog } from "@/modules/parties/DeletePartyDialog";
import { PartyFormDialog } from "@/modules/parties/PartyFormDialog";
import type { Party, PartyKind } from "@/modules/parties/types";
import { getBalanceTone, getPartyMeta } from "@/modules/parties/utils";
import { cn } from "@/lib/utils";
import { formatEGP } from "@/shared/utils/money";

export function PartyPage({ kind }: { kind: PartyKind }) {
  const [search, setSearch] = useState("");
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [deletingParty, setDeletingParty] = useState<Party | null>(null);
  const [ledgerCustomerId, setLedgerCustomerId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const deferredSearch = useDeferredValue(search);
  const meta = getPartyMeta(kind);

  const partiesQuery = useQuery({
    queryKey: [kind, deferredSearch],
    queryFn: () =>
      invoke<Party[]>(`list_${kind}s`, {
        search: deferredSearch.trim() || null,
      }),
    staleTime: 30 * 1000,
  });

  const parties = partiesQuery.data ?? [];

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{meta.plural}</h1>
        <p className="text-sm text-muted-foreground">
          إدارة بيانات {meta.plural} الأساسية ومتابعة الأرصدة الحالية.
        </p>
      </header>

      <Card className="border-none bg-transparent p-0 shadow-none ring-0">
        <CardContent className="space-y-4 px-0">
          <div className="flex flex-col-reverse gap-3 rounded-2xl border bg-card p-4 lg:flex-row-reverse lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="absolute inset-e-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                dir="rtl"
                className="pe-9"
                placeholder={meta.searchPlaceholder}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <Button onClick={() => setIsCreateOpen(true)}>
              <BadgePlus />
              {`إضافة ${meta.singular}`}
            </Button>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle>{`قائمة ${meta.plural}`}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-right">
                  <thead className="bg-muted/40 text-sm text-muted-foreground">
                    <tr>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>الرصيد</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {partiesQuery.isLoading ? (
                      <LoadingRows />
                    ) : parties.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-16">
                          <div className="flex flex-col items-center justify-center gap-3 text-center">
                            <Users className="size-10 text-muted-foreground" />
                            <p className="text-base font-medium">
                              {meta.empty}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      parties.map((party) => (
                        <tr
                          key={party.id}
                          className="border-t transition-colors hover:bg-muted/30"
                        >
                          <TableCell className="font-medium text-foreground">
                            <div className="space-y-1">
                              <p>{party.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {party.address || "—"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{party.phone || "—"}</TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "font-medium",
                                getBalanceTone(party.balance_millieme),
                              )}
                            >
                              {formatEGP(party.balance_millieme)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-row-reverse justify-start gap-2">
                              {kind === "customer" && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => setLedgerCustomerId(party.id)}
                                  aria-label="سجل العميل"
                                >
                                  <BookOpen />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setEditingParty(party)}
                                aria-label={`تعديل ${meta.singular}`}
                              >
                                <Edit3 />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeletingParty(party)}
                                aria-label={`حذف ${meta.singular}`}
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          </TableCell>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <PartyFormDialog
        kind={kind}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      <PartyFormDialog
        kind={kind}
        party={editingParty}
        open={Boolean(editingParty)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingParty(null);
          }
        }}
      />

      <DeletePartyDialog
        kind={kind}
        party={deletingParty}
        open={Boolean(deletingParty)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingParty(null);
          }
        }}
      />

      <CustomerLedgerSheet
        customerId={ledgerCustomerId}
        open={ledgerCustomerId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLedgerCustomerId(null);
          }
        }}
      />
    </div>
  );
}

function LoadingRows() {
  return Array.from({ length: 6 }).map((_, index) => (
    <tr key={index} className="border-t">
      {Array.from({ length: 4 }).map((__, cellIndex) => (
        <td key={cellIndex} className="px-4 py-3">
          <Skeleton className="h-5 w-full max-w-24" />
        </td>
      ))}
    </tr>
  ));
}

function TableHead({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 text-right font-medium">{children}</th>;
}

function TableCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 align-middle ${className ?? ""}`}>{children}</td>
  );
}
