package domain

type CreateRealm struct {
	Name string `json:"name"`
}

type SuspendRealm struct {
	RealmID string `json:"realm_id"`
	Reason  string `json:"reason"`
}
