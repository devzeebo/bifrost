package domain

const (
	EventRuneCreated       = "RuneCreated"
	EventRuneUpdated       = "RuneUpdated"
	EventRuneClaimed       = "RuneClaimed"
	EventRuneFulfilled     = "RuneFulfilled"
	EventRuneForged        = "RuneForged"
	EventRuneSealed        = "RuneSealed"
	EventDependencyAdded   = "DependencyAdded"
	EventDependencyRemoved = "DependencyRemoved"
	EventRuneNoted         = "RuneNoted"
	EventRuneUnclaimed     = "RuneUnclaimed"
	EventRuneShattered     = "RuneShattered"
)

const (
	RelBlocks     = "blocks"
	RelRelatesTo  = "relates_to"
	RelDuplicates = "duplicates"
	RelSupersedes = "supersedes"
	RelRepliesTo  = "replies_to"

	RelBlockedBy    = "blocked_by"
	RelDuplicatedBy = "duplicated_by"
	RelSupersededBy = "superseded_by"
	RelRepliedToBy  = "replied_to_by"
)

type RuneCreated struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Priority    int    `json:"priority"`
	ParentID    string `json:"parent_id,omitempty"`
	Branch      string `json:"branch,omitempty"`
}

type RuneForged struct {
	ID string `json:"id"`
}

type RuneUpdated struct {
	ID          string  `json:"id"`
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
	Priority    *int    `json:"priority,omitempty"`
	Branch      *string `json:"branch,omitempty"`
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
	IsInverse    bool   `json:"is_inverse,omitempty"`
}

type DependencyRemoved struct {
	RuneID       string `json:"rune_id"`
	TargetID     string `json:"target_id"`
	Relationship string `json:"relationship"`
	IsInverse    bool   `json:"is_inverse,omitempty"`
}

func ReflectRelationship(rel string) string {
	switch rel {
	case RelBlocks:
		return RelBlockedBy
	case RelBlockedBy:
		return RelBlocks
	case RelDuplicates:
		return RelDuplicatedBy
	case RelDuplicatedBy:
		return RelDuplicates
	case RelSupersedes:
		return RelSupersededBy
	case RelSupersededBy:
		return RelSupersedes
	case RelRepliesTo:
		return RelRepliedToBy
	case RelRepliedToBy:
		return RelRepliesTo
	case RelRelatesTo:
		return RelRelatesTo
	default:
		return ""
	}
}

func IsInverseRelationship(rel string) bool {
	switch rel {
	case RelBlockedBy, RelDuplicatedBy, RelSupersededBy, RelRepliedToBy:
		return true
	default:
		return false
	}
}

type RuneUnclaimed struct {
	ID string `json:"id"`
}

type RuneNoted struct {
	RuneID string `json:"rune_id"`
	Text   string `json:"text"`
}

type RuneShattered struct {
	ID string `json:"id"`
}
