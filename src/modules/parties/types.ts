export type PartyKind = "customer" | "supplier";

export type Customer = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  balance_millieme: number;
  credit_limit_millieme: number;
  notes: string | null;
  is_active: number;
  created_at: string;
};

export type Supplier = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  balance_millieme: number;
  tax_number: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
};

export type Party = Customer | Supplier;

export type PartyFormValues = {
  name: string;
  phone: string;
  address: string;
  balance: string;
  credit_limit: string;
  tax_number: string;
  notes: string;
};

