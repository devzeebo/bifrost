export type RuneStatus = "draft" | "open" | "in_progress" | "fulfilled" | "sealed";

export type RuneRelationshipType =
  | "blocks"
  | "blocked_by"
  | "relates_to"
  | "duplicates"
  | "duplicated_by"
  | "supersedes"
  | "superseded_by"
  | "replies_to"
  | "replied_to_by";

export type RuneRelationship = {
  target_id: string;
  relationship: RuneRelationshipType | string;
};

export interface RuneListItem {
  id: string;
  title: string;
  status: RuneStatus;
  priority: number;
  claimant?: string;
  claimant_username?: string;
  dependencies_count?: number;
  dependents_count?: number;
  tags?: string[];
  realm_id: string;
  created_at: string;
  updated_at: string;
}


export interface RuneDetail extends RuneListItem {
  description: string;
  branch?: string;
  saga_id?: string;
  assignee_id?: string;
  dependencies: RuneRelationship[];
  tags: string[];
}

export interface CreateRuneRequest {
  title: string;
  description?: string;
  priority: number;
  branch: string;
  parent_id?: string;
  saga_id?: string;
  tags?: string[];
}
