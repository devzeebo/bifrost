package domain

type CreateRune struct {
	Title       string  `json:"title"`
	Description string  `json:"description,omitempty"`
	Priority    int     `json:"priority"`
	ParentID    string  `json:"parent_id,omitempty"`
	Branch      *string `json:"branch,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	Type        string  `json:"type,omitempty"`
}

type UpdateRune struct {
	ID          string  `json:"id"`
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
	Priority    *int    `json:"priority,omitempty"`
	Branch      *string `json:"branch,omitempty"`
	Tags        *[]string `json:"tags,omitempty"`
	AddTags     []string `json:"add_tags,omitempty"`
	RemoveTags  []string `json:"remove_tags,omitempty"`
}

type ClaimRune struct {
	ID       string `json:"id"`
	Claimant string `json:"claimant"`
}

type UnclaimRune struct {
	ID string `json:"id"`
}

type ForgeRune struct {
	ID string `json:"id"`
}

type FulfillRune struct {
	ID string `json:"id"`
}

type SealRune struct {
	ID     string `json:"id"`
	Reason string `json:"reason,omitempty"`
}

type ShatterRune struct {
	ID string `json:"id"`
}

type AddDependency struct {
	RuneID       string `json:"rune_id"`
	TargetID     string `json:"target_id"`
	Relationship string `json:"relationship"`
}

type RemoveDependency struct {
	RuneID       string `json:"rune_id"`
	TargetID     string `json:"target_id"`
	Relationship string `json:"relationship"`
}

type AddNote struct {
	RuneID string `json:"rune_id"`
	Text   string `json:"text"`
}

type AddRetro struct {
	RuneID string `json:"rune_id"`
	Text   string `json:"text"`
}

type AddACItem struct {
	RuneID      string `json:"rune_id"`
	Scenario    string `json:"scenario"`
	Description string `json:"description"`
}

type UpdateACItem struct {
	RuneID      string `json:"rune_id"`
	ID          string `json:"id"`
	Scenario    string `json:"scenario"`
	Description string `json:"description"`
}

type RemoveACItem struct {
	RuneID string `json:"rune_id"`
	ID     string `json:"id"`
}
