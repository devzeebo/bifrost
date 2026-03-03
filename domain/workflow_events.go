package domain

const (
	EventWorkflowCreated  = "WorkflowCreated"
	EventWorkflowUpdated  = "WorkflowUpdated"
	EventWorkflowDeleted  = "WorkflowDeleted"
)

type WorkflowCreated struct {
	WorkflowID string `json:"workflow_id"`
	Name       string `json:"name"`
	Content    string `json:"content"`
}

type WorkflowUpdated struct {
	WorkflowID string  `json:"workflow_id"`
	Name       *string `json:"name,omitempty"`
	Content    *string `json:"content,omitempty"`
}

type WorkflowDeleted struct {
	WorkflowID string `json:"workflow_id"`
}
