import { parseAppError } from "@/modules/items/utils";
import type { Party, PartyFormValues, PartyKind } from "@/modules/parties/types";
import { toMillieme } from "@/shared/utils/money";

export { parseAppError };

export function toPartyFormValues(
  kind: PartyKind,
  party?: Party | null,
): PartyFormValues {
  const customer = kind === "customer" ? (party as Extract<Party, { credit_limit_millieme: number }> | null | undefined) : null;
  const supplier = kind === "supplier" ? (party as Extract<Party, { tax_number: string | null }> | null | undefined) : null;

  return {
    name: party?.name ?? "",
    phone: party?.phone ?? "",
    address: party?.address ?? "",
    balance: moneyToInput(party?.balance_millieme ?? 0),
    credit_limit: customer ? moneyToInput(customer.credit_limit_millieme) : "0",
    tax_number: supplier?.tax_number ?? "",
    notes: party?.notes ?? "",
  };
}

export function toPartyPayload(kind: PartyKind, values: PartyFormValues) {
  const payload = {
    name: values.name.trim(),
    phone: values.phone.trim() || null,
    address: values.address.trim() || null,
    balance_millieme: toMillieme(values.balance || 0),
    notes: values.notes.trim() || null,
  };

  if (kind === "customer") {
    return {
      ...payload,
      credit_limit_millieme: toMillieme(values.credit_limit || 0),
    };
  }

  return {
    ...payload,
    tax_number: values.tax_number.trim() || null,
  };
}

export function getPartyMeta(kind: PartyKind) {
  return kind === "customer"
    ? {
        singular: "العميل",
        plural: "العملاء",
        empty: "لا يوجد عملاء",
        searchPlaceholder: "ابحث بالاسم أو الهاتف...",
      }
    : {
        singular: "المورد",
        plural: "الموردين",
        empty: "لا يوجد موردين",
        searchPlaceholder: "ابحث بالاسم أو الهاتف...",
      };
}

function moneyToInput(milliemes: number) {
  const value = (milliemes / 1000).toFixed(3);
  return value.replace(/\.?0+$/, "");
}
