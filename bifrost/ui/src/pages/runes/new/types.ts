export type FormData = {
  title: string;
  description: string;
  priority: number;
  status: "draft" | "open";
  branch: string;
};

export type RelationshipDirection = "outgoing" | "incoming";

export type SelectedRelationship = {
  targetId: string;
  direction: RelationshipDirection;
};
