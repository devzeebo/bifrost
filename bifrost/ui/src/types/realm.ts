export type RealmStatus = "active" | "inactive";

export type RealmListEntry = {
  id: string;
  name: string;
  status: RealmStatus;
  created_at: string;
}

export type RealmDetail = {
  description: string;
  owner_id: string;
  member_count: number;
} & RealmListEntry

export type CreateRealmRequest = {
  name: string;
  description?: string;
}

export type CreateRealmResponse = {
  id: string;
  name: string;
}
