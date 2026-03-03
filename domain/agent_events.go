package domain

const (
	EventAgentCreated        = "AgentCreated"
	EventAgentUpdated        = "AgentUpdated"
	EventAgentRealmGranted   = "AgentRealmGranted"
	EventAgentRealmRevoked   = "AgentRealmRevoked"
	EventAgentSkillAdded     = "AgentSkillAdded"
	EventAgentWorkflowAdded  = "AgentWorkflowAdded"
)

type AgentCreated struct {
	AgentID string `json:"agent_id"`
	Name    string `json:"name"`
}

type AgentUpdated struct {
	AgentID        string  `json:"agent_id"`
	Name           *string `json:"name,omitempty"`
	MainWorkflowID *string `json:"main_workflow_id,omitempty"`
}

type AgentRealmGranted struct {
	AgentID string `json:"agent_id"`
	RealmID string `json:"realm_id"`
}

type AgentRealmRevoked struct {
	AgentID string `json:"agent_id"`
	RealmID string `json:"realm_id"`
}

type AgentSkillAdded struct {
	AgentID string `json:"agent_id"`
	SkillID string `json:"skill_id"`
}

type AgentWorkflowAdded struct {
	AgentID    string `json:"agent_id"`
	WorkflowID string `json:"workflow_id"`
}
