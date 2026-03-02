export type RealmStatus = "active" | "archived";

export interface RealmListEntry {
  id: string;
  name: string;
  status: RealmStatus;
  created_at: string;
}

export interface RealmDetail extends RealmListEntry {
  description: string;
  owner_id: string;
  member_count: number;
}


export interface CreateRealmRequest {
  name: string;
  description?: string;
}

export interface CreateRealmResponse {
  id: string;
  name: string;
}
