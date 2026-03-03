package domain

const (
	EventSkillCreated  = "SkillCreated"
	EventSkillUpdated  = "SkillUpdated"
	EventSkillDeleted  = "SkillDeleted"
)

type SkillCreated struct {
	SkillID string `json:"skill_id"`
	Name    string `json:"name"`
	Content string `json:"content"`
}

type SkillUpdated struct {
	SkillID string  `json:"skill_id"`
	Name    *string `json:"name,omitempty"`
	Content *string `json:"content,omitempty"`
}

type SkillDeleted struct {
	SkillID string `json:"skill_id"`
}
