package domain

type CreateAccount struct {
	Username string `json:"username"`
}

type SuspendAccount struct {
	AccountID string `json:"account_id"`
	Reason    string `json:"reason"`
}

type GrantRealm struct {
	AccountID string `json:"account_id"`
	RealmID   string `json:"realm_id"`
}

type RevokeRealm struct {
	AccountID string `json:"account_id"`
	RealmID   string `json:"realm_id"`
}

type CreatePAT struct {
	AccountID string `json:"account_id"`
	Label     string `json:"label"`
}

type RevokePAT struct {
	AccountID string `json:"account_id"`
	PATID     string `json:"pat_id"`
}

type CreateAccountResult struct {
	AccountID string `json:"account_id"`
	RawToken  string `json:"raw_token"`
}

type CreatePATResult struct {
	PATID    string `json:"pat_id"`
	RawToken string `json:"raw_token"`
}
