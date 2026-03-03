package domain

type CreateSkill struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

type UpdateSkill struct {
	SkillID  string  `json:"skill_id"`
	Name     *string `json:"name,omitempty"`
	Content  *string `json:"content,omitempty"`
}

type DeleteSkill struct {
	SkillID string `json:"skill_id"`
}

type CreateSkillResult struct {
	SkillID string `json:"skill_id"`
}
