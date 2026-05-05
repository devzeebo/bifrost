package domain

import "time"

const (
	EventRealmCreated   = "RealmCreated"
	EventRealmSuspended = "RealmSuspended"
)

type RealmCreated struct {
	RealmID   string    `json:"realm_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type RealmSuspended struct {
	RealmID string `json:"realm_id"`
	Reason  string `json:"reason"`
}
