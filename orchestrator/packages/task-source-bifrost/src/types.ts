export type BifrostTaskSourceConfig = {
  pollInterval?: number;
  maxPollInterval?: number;
};

export type BifrostConfig = {
  url: string;
  realm: string;
};

export type BifrostCredentials = {
  credentials: Record<string, { token: string }>;
};

export type ReadyRune = {
  id: string;
  title: string;
  status: string;
  priority: number;
  claimant?: string;
  tags: string[];
  realm_id: string;
  created_at: string;
  updated_at: string;
};

export type RuneDetail = {
  description: string;
  branch?: string;
  saga_id?: string;
  assignee_id?: string;
  dependencies: { target_id: string; relationship: string }[];
} & ReadyRune;
