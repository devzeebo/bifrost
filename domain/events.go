package domain

const (
	EventRuneCreated       = "RuneCreated"
	EventRuneUpdated       = "RuneUpdated"
	EventRuneClaimed       = "RuneClaimed"
	EventRuneFulfilled     = "RuneFulfilled"
	EventRuneSealed        = "RuneSealed"
	EventDependencyAdded   = "DependencyAdded"
	EventDependencyRemoved = "DependencyRemoved"
	EventRuneNoted         = "RuneNoted"
)

const (
	RelBlocks     = "blocks"
	RelRelatesTo  = "relates_to"
	RelDuplicates = "duplicates"
	RelSupersedes = "supersedes"
	RelRepliesTo  = "replies_to"
)

type RuneCreated struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Priority    int    `json:"priority"`
	ParentID    string `json:"parent_id,omitempty"`
}

type RuneUpdated struct {
	ID          string  `json:"id"`
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
	Priority    *int    `json:"priority,omitempty"`
}

type RuneClaimed struct {
	ID       string `json:"id"`
	Claimant string `json:"claimant"`
}

type RuneFulfilled struct {
	ID string `json:"id"`
}

type RuneSealed struct {
	ID     string `json:"id"`
	Reason string `json:"reason,omitempty"`
}

type DependencyAdded struct {
	RuneID       string `json:"rune_id"`
	TargetID     string `json:"target_id"`
	Relationship string `json:"relationship"`
}

type DependencyRemoved struct {
	RuneID       string `json:"rune_id"`
	TargetID     string `json:"target_id"`
	Relationship string `json:"relationship"`
}

type RuneNoted struct {
	RuneID string `json:"rune_id"`
	Text   string `json:"text"`
}
