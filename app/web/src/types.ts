export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  is_admin: boolean;
  created_at: string;
}

export interface AdminAccount extends Account {
  owner_id: string;
  owner_email: string;
  owner_name: string;
}

export interface CurrencyBalance {
  currency: string;
  total_cents: number;
}

export interface AdminStats {
  user_count: number;
  account_count: number;
  transaction_count: number;
  balances_by_currency: CurrencyBalance[];
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type AccountStatus = 'active' | 'frozen' | 'closed';

export type TxnType = 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out';

export interface Account {
  id: string;
  holder_name: string;
  currency: string;
  balance_cents: number;
  status: AccountStatus;
  created_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  type: TxnType;
  amount_cents: number;
  balance_after_cents: number;
  counterparty_account_id: string | null;
  reference: string | null;
  created_at: string;
}

export interface MonthlyPoint {
  month: string; // "YYYY-MM"
  in_cents: number;
  out_cents: number;
}

export interface TypeBreakdown {
  type: TxnType;
  total_cents: number;
  count: number;
}

export interface Insights {
  currency: string;
  total_in_cents: number;
  total_out_cents: number;
  net_cents: number;
  monthly: MonthlyPoint[];
  by_type: TypeBreakdown[];
}
