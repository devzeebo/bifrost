package domain

type CreateAgent struct {
	Name string `json:"name"`
}

type UpdateAgent struct {
	AgentID        string  `json:"agent_id"`
	Name           *string `json:"name,omitempty"`
	MainWorkflowID *string `json:"main_workflow_id,omitempty"`
}

type GrantAgentRealm struct {
	AgentID string `json:"agent_id"`
	RealmID string `json:"realm_id"`
}

type RevokeAgentRealm struct {
	AgentID string `json:"agent_id"`
	RealmID string `json:"realm_id"`
}

type AddAgentSkill struct {
	AgentID string `json:"agent_id"`
	SkillID string `json:"skill_id"`
}

type AddAgentWorkflow struct {
	AgentID    string `json:"agent_id"`
	WorkflowID string `json:"workflow_id"`
}

type CreateAgentResult struct {
	AgentID string `json:"agent_id"`
}
