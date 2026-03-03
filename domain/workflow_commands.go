package domain

type CreateWorkflow struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

type UpdateWorkflow struct {
	WorkflowID string  `json:"workflow_id"`
	Name       *string `json:"name,omitempty"`
	Content    *string `json:"content,omitempty"`
}

type DeleteWorkflow struct {
	WorkflowID string `json:"workflow_id"`
}

type CreateWorkflowResult struct {
	WorkflowID string `json:"workflow_id"`
}
