package domain

import "time"

const (
	EventAccountCreated   = "AccountCreated"
	EventAccountSuspended = "AccountSuspended"
	EventRealmGranted     = "RealmGranted"
	EventRealmRevoked     = "RealmRevoked"
	EventPATCreated       = "PATCreated"
	EventPATRevoked       = "PATRevoked"
	EventRoleAssigned     = "RoleAssigned"
	EventRoleRevoked      = "RoleRevoked"
)

type AccountCreated struct {
	AccountID string    `json:"account_id"`
	Username  string    `json:"username"`
	CreatedAt time.Time `json:"created_at"`
}

type AccountSuspended struct {
	AccountID string `json:"account_id"`
	Reason    string `json:"reason"`
}

type RealmGranted struct {
	AccountID string `json:"account_id"`
	RealmID   string `json:"realm_id"`
}

type RealmRevoked struct {
	AccountID string `json:"account_id"`
	RealmID   string `json:"realm_id"`
}

type PATCreated struct {
	AccountID string    `json:"account_id"`
	PATID     string    `json:"pat_id"`
	KeyHash   string    `json:"key_hash"`
	Label     string    `json:"label"`
	CreatedAt time.Time `json:"created_at"`
}

type PATRevoked struct {
	AccountID string `json:"account_id"`
	PATID     string `json:"pat_id"`
}

type RoleAssigned struct {
	AccountID string `json:"account_id"`
	RealmID   string `json:"realm_id"`
	Role      string `json:"role"`
}

type RoleRevoked struct {
	AccountID string `json:"account_id"`
	RealmID   string `json:"realm_id"`
}
