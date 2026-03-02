export type AccountStatus = "active" | "inactive";

export interface AccountListEntry {
  id: string;
  username: string;
  status: AccountStatus;
  created_at: string;
}

export interface PatEntry {
  id: string;
  label?: string;
  token_preview?: string;
  created_at: string;
  last_used?: string;
}


export interface AdminAccountEntry {
  account_id: string;
  username: string;
  status: AccountStatus;
  realms: string[];
  roles: Record<string, string>;
  pat_count: number;
  created_at: string;
}
