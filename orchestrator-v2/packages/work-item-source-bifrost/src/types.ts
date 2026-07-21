export type BifrostWorkItemSourceConfig = {
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
  parent_id?: string;
};

export type RuneNoteEntry = {
  text: string;
  created_at: string;
};

export type RuneACEntry = {
  id: string;
  scenario: string;
  description: string;
};

export type RuneRetroEntry = {
  text: string;
  created_at: string;
};

export type RuneDetail = ReadyRune & {
  description: string;
  branch?: string;
  assignee_id?: string;
  parent_id?: string;
  type?: string;
  dependencies: { target_id: string; relationship: string }[];
  notes: RuneNoteEntry[];
  retro_items: RuneRetroEntry[];
  acceptance_criteria: RuneACEntry[];
  state: Record<string, unknown>;
};

export type CreateRuneRequest = {
  title: string;
  description?: string;
  priority: number;
  parent_id?: string;
  branch?: string;
  tags?: string[];
  type?: string;
};

export type UpdateRuneRequest = {
  id: string;
  title?: string;
  description?: string;
  priority?: number;
  branch?: string;
  tags?: string[];
};
