package admin

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/devzeebo/bifrost/domain"
)

// AgentListEntry is the JSON response for an agent in the list.
type AgentListEntry struct {
	AgentID        string   `json:"agent_id"`
	Name           string   `json:"name"`
	MainWorkflowID string   `json:"main_workflow_id,omitempty"`
	Realms         []string `json:"realms,omitempty"`
}

// AgentDetail is the JSON response for a single agent.
type AgentDetail struct {
	AgentID        string            `json:"agent_id"`
	Name           string            `json:"name"`
	MainWorkflowID string            `json:"main_workflow_id,omitempty"`
	Realms         []string          `json:"realms,omitempty"`
	Skills         []string          `json:"skills,omitempty"`
	Workflows      []string          `json:"workflows,omitempty"`
}

// CreateAgentRequest is the request body for POST /admin/agents.
type CreateAgentRequest struct {
	Name string `json:"name"`
}

// CreateAgentResponse is the response for POST /admin/agents.
type CreateAgentResponse struct {
	AgentID string `json:"agent_id"`
}

// UpdateAgentRequest is the request body for PUT /admin/agents/{id}.
type UpdateAgentRequest struct {
	Name           *string `json:"name,omitempty"`
	MainWorkflowID *string `json:"main_workflow_id,omitempty"`
}

// GrantAgentRealmRequest is the request body for POST /admin/agents/{id}/realms.
type GrantAgentRealmRequest struct {
	RealmID string `json:"realm_id"`
}

// SkillListEntry is the JSON response for a skill in the list.
type SkillListEntry struct {
	SkillID string `json:"skill_id"`
	Name    string `json:"name"`
}

// SkillDetail is the JSON response for a single skill.
type SkillDetail struct {
	SkillID string `json:"skill_id"`
	Name    string `json:"name"`
	Content string `json:"content"`
}

// CreateSkillRequest is the request body for POST /admin/skills.
type CreateSkillRequest struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// CreateSkillResponse is the response for POST /admin/skills.
type CreateSkillResponse struct {
	SkillID string `json:"skill_id"`
}

// UpdateSkillRequest is the request body for PUT /admin/skills/{id}.
type UpdateSkillRequest struct {
	Name    *string `json:"name,omitempty"`
	Content *string `json:"content,omitempty"`
}

// WorkflowListEntry is the JSON response for a workflow in the list.
type WorkflowListEntry struct {
	WorkflowID string `json:"workflow_id"`
	Name       string `json:"name"`
}

// WorkflowDetail is the JSON response for a single workflow.
type WorkflowDetail struct {
	WorkflowID string `json:"workflow_id"`
	Name       string `json:"name"`
	Content    string `json:"content"`
}

// CreateWorkflowRequest is the request body for POST /admin/workflows.
type CreateWorkflowRequest struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// CreateWorkflowResponse is the response for POST /admin/workflows.
type CreateWorkflowResponse struct {
	WorkflowID string `json:"workflow_id"`
}

// UpdateWorkflowRequest is the request body for PUT /admin/workflows/{id}.
type UpdateWorkflowRequest struct {
	Name    *string `json:"name,omitempty"`
	Content *string `json:"content,omitempty"`
}

// RegisterAgentsAPIRoutes registers the agents, skills, and workflows JSON API routes.
func RegisterAgentsAPIRoutes(mux *http.ServeMux, cfg *RouteConfig) {
	authMiddleware := AuthMiddleware(cfg.AuthConfig, cfg.ProjectionStore)
	requireAdmin := RequireAdminMiddleware()

	// Agent endpoints
	mux.Handle("POST /admin/agents", authMiddleware(requireAdmin(http.HandlerFunc(handleCreateAgent(cfg)))))
	mux.Handle("GET /admin/agents", authMiddleware(requireAdmin(http.HandlerFunc(handleListAgents(cfg)))))
	mux.Handle("GET /admin/agents/{id}", authMiddleware(requireAdmin(http.HandlerFunc(handleGetAgent(cfg)))))
	mux.Handle("PUT /admin/agents/{id}", authMiddleware(requireAdmin(http.HandlerFunc(handleUpdateAgent(cfg)))))
	mux.Handle("POST /admin/agents/{id}/realms", authMiddleware(requireAdmin(http.HandlerFunc(handleGrantAgentRealm(cfg)))))
	mux.Handle("DELETE /admin/agents/{id}/realms/{realm_id}", authMiddleware(requireAdmin(http.HandlerFunc(handleRevokeAgentRealm(cfg)))))

	// Skill endpoints
	mux.Handle("POST /admin/skills", authMiddleware(requireAdmin(http.HandlerFunc(handleCreateSkill(cfg)))))
	mux.Handle("GET /admin/skills", authMiddleware(requireAdmin(http.HandlerFunc(handleListSkills(cfg)))))
	mux.Handle("GET /admin/skills/{id}", authMiddleware(requireAdmin(http.HandlerFunc(handleGetSkill(cfg)))))
	mux.Handle("PUT /admin/skills/{id}", authMiddleware(requireAdmin(http.HandlerFunc(handleUpdateSkill(cfg)))))
	mux.Handle("DELETE /admin/skills/{id}", authMiddleware(requireAdmin(http.HandlerFunc(handleDeleteSkill(cfg)))))

	// Workflow endpoints
	mux.Handle("POST /admin/workflows", authMiddleware(requireAdmin(http.HandlerFunc(handleCreateWorkflow(cfg)))))
	mux.Handle("GET /admin/workflows", authMiddleware(requireAdmin(http.HandlerFunc(handleListWorkflows(cfg)))))
	mux.Handle("GET /admin/workflows/{id}", authMiddleware(requireAdmin(http.HandlerFunc(handleGetWorkflow(cfg)))))
	mux.Handle("PUT /admin/workflows/{id}", authMiddleware(requireAdmin(http.HandlerFunc(handleUpdateWorkflow(cfg)))))
	mux.Handle("DELETE /admin/workflows/{id}", authMiddleware(requireAdmin(http.HandlerFunc(handleDeleteWorkflow(cfg)))))
}

// --- Agent Handlers ---

func handleCreateAgent(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req CreateAgentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		name := strings.TrimSpace(req.Name)
		if name == "" {
			http.Error(w, "name is required", http.StatusBadRequest)
			return
		}

		result, err := domain.HandleCreateAgent(r.Context(), domain.CreateAgent{
			Name: name,
		}, cfg.EventStore)
		if err != nil {
			log.Printf("handleCreateAgent: failed: %v", err)
			http.Error(w, "failed to create agent", http.StatusInternalServerError)
			return
		}

		resp := CreateAgentResponse{
			AgentID: result.AgentID,
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(resp)
	}
}

func handleListAgents(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Read all agent streams from event store
		agents := []AgentListEntry{}

		if cfg.EventStore != nil {
			events, err := cfg.EventStore.ReadAll(r.Context(), domain.AdminRealmID, 0)
			if err != nil {
				log.Printf("handleListAgents: failed to read events: %v", err)
				http.Error(w, "failed to list agents", http.StatusInternalServerError)
				return
			}

			// Group events by stream and build agent states
			agentStates := make(map[string]*domain.AgentState)
			for _, evt := range events {
				if evt.StreamID == "" || !strings.HasPrefix(evt.StreamID, "agent-") {
					continue
				}
				agentID := strings.TrimPrefix(evt.StreamID, "agent-")
				if agentStates[agentID] == nil {
					agentStates[agentID] = &domain.AgentState{}
					agentStates[agentID].Realms = make(map[string]bool)
					agentStates[agentID].Skills = make(map[string]bool)
					agentStates[agentID].Workflows = make(map[string]bool)
				}

				switch evt.EventType {
				case domain.EventAgentCreated:
					var data domain.AgentCreated
					if err := json.Unmarshal(evt.Data, &data); err == nil {
						agentStates[agentID].Exists = true
						agentStates[agentID].AgentID = data.AgentID
						agentStates[agentID].Name = data.Name
					}
				case domain.EventAgentUpdated:
					var data domain.AgentUpdated
					if err := json.Unmarshal(evt.Data, &data); err == nil {
						if data.Name != nil {
							agentStates[agentID].Name = *data.Name
						}
						if data.MainWorkflowID != nil {
							agentStates[agentID].MainWorkflowID = *data.MainWorkflowID
						}
					}
				case domain.EventAgentRealmGranted:
					var data domain.AgentRealmGranted
					if err := json.Unmarshal(evt.Data, &data); err == nil {
						agentStates[agentID].Realms[data.RealmID] = true
					}
				case domain.EventAgentRealmRevoked:
					var data domain.AgentRealmRevoked
					if err := json.Unmarshal(evt.Data, &data); err == nil {
						delete(agentStates[agentID].Realms, data.RealmID)
					}
				}
			}

			// Convert to list entries
			for _, state := range agentStates {
				if state.Exists {
					realms := make([]string, 0, len(state.Realms))
					for realmID := range state.Realms {
						realms = append(realms, realmID)
					}
					agents = append(agents, AgentListEntry{
						AgentID:        state.AgentID,
						Name:           state.Name,
						MainWorkflowID: state.MainWorkflowID,
						Realms:         realms,
					})
				}
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(agents)
	}
}

func handleGetAgent(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		agentID := r.PathValue("id")
		if agentID == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		if cfg.EventStore == nil {
			http.Error(w, "agent not found", http.StatusNotFound)
			return
		}

		streamID := "agent-" + agentID
		events, err := cfg.EventStore.ReadStream(r.Context(), domain.AdminRealmID, streamID, 0)
		if err != nil || len(events) == 0 {
			http.Error(w, "agent not found", http.StatusNotFound)
			return
		}

		state := domain.RebuildAgentState(events)
		if !state.Exists {
			http.Error(w, "agent not found", http.StatusNotFound)
			return
		}

		realms := make([]string, 0, len(state.Realms))
		for realmID := range state.Realms {
			realms = append(realms, realmID)
		}

		skills := make([]string, 0, len(state.Skills))
		for skillID := range state.Skills {
			skills = append(skills, skillID)
		}

		workflows := make([]string, 0, len(state.Workflows))
		for workflowID := range state.Workflows {
			workflows = append(workflows, workflowID)
		}

		detail := AgentDetail{
			AgentID:        state.AgentID,
			Name:           state.Name,
			MainWorkflowID: state.MainWorkflowID,
			Realms:         realms,
			Skills:         skills,
			Workflows:      workflows,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(detail)
	}
}

func handleUpdateAgent(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		agentID := r.PathValue("id")
		if agentID == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		var req UpdateAgentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		err := domain.HandleUpdateAgent(r.Context(), domain.UpdateAgent{
			AgentID:        agentID,
			Name:           req.Name,
			MainWorkflowID: req.MainWorkflowID,
		}, cfg.EventStore)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				http.Error(w, "agent not found", http.StatusNotFound)
				return
			}
			log.Printf("handleUpdateAgent: failed: %v", err)
			http.Error(w, "failed to update agent", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func handleGrantAgentRealm(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		agentID := r.PathValue("id")
		if agentID == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		var req GrantAgentRealmRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		if req.RealmID == "" {
			http.Error(w, "realm_id is required", http.StatusBadRequest)
			return
		}

		err := domain.HandleGrantAgentRealm(r.Context(), domain.GrantAgentRealm{
			AgentID: agentID,
			RealmID: req.RealmID,
		}, cfg.EventStore)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				http.Error(w, "agent not found", http.StatusNotFound)
				return
			}
			log.Printf("handleGrantAgentRealm: failed: %v", err)
			http.Error(w, "failed to grant realm access", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func handleRevokeAgentRealm(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		agentID := r.PathValue("id")
		realmID := r.PathValue("realm_id")
		if agentID == "" || realmID == "" {
			http.Error(w, "id and realm_id are required", http.StatusBadRequest)
			return
		}

		err := domain.HandleRevokeAgentRealm(r.Context(), domain.RevokeAgentRealm{
			AgentID: agentID,
			RealmID: realmID,
		}, cfg.EventStore)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				http.Error(w, "agent not found", http.StatusNotFound)
				return
			}
			if strings.Contains(err.Error(), "not granted") {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			log.Printf("handleRevokeAgentRealm: failed: %v", err)
			http.Error(w, "failed to revoke realm access", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// --- Skill Handlers ---

func handleCreateSkill(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req CreateSkillRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		name := strings.TrimSpace(req.Name)
		if name == "" {
			http.Error(w, "name is required", http.StatusBadRequest)
			return
		}

		result, err := domain.HandleCreateSkill(r.Context(), domain.CreateSkill{
			Name:    name,
			Content: req.Content,
		}, cfg.EventStore)
		if err != nil {
			log.Printf("handleCreateSkill: failed: %v", err)
			http.Error(w, "failed to create skill", http.StatusInternalServerError)
			return
		}

		resp := CreateSkillResponse{
			SkillID: result.SkillID,
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(resp)
	}
}

func handleListSkills(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		skills := []SkillListEntry{}

		if cfg.EventStore != nil {
			events, err := cfg.EventStore.ReadAll(r.Context(), domain.AdminRealmID, 0)
			if err != nil {
				log.Printf("handleListSkills: failed to read events: %v", err)
				http.Error(w, "failed to list skills", http.StatusInternalServerError)
				return
			}

			skillStates := make(map[string]*domain.SkillState)
			for _, evt := range events {
				if evt.StreamID == "" || !strings.HasPrefix(evt.StreamID, "skill-") {
					continue
				}
				skillID := strings.TrimPrefix(evt.StreamID, "skill-")
				if skillStates[skillID] == nil {
					skillStates[skillID] = &domain.SkillState{}
				}

				switch evt.EventType {
				case domain.EventSkillCreated:
					var data domain.SkillCreated
					if err := json.Unmarshal(evt.Data, &data); err == nil {
						skillStates[skillID].Exists = true
						skillStates[skillID].SkillID = data.SkillID
						skillStates[skillID].Name = data.Name
					}
				case domain.EventSkillDeleted:
					skillStates[skillID].Deleted = true
				}
			}

			for _, state := range skillStates {
				if state.Exists && !state.Deleted {
					skills = append(skills, SkillListEntry{
						SkillID: state.SkillID,
						Name:    state.Name,
					})
				}
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(skills)
	}
}

func handleGetSkill(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		skillID := r.PathValue("id")
		if skillID == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		if cfg.EventStore == nil {
			http.Error(w, "skill not found", http.StatusNotFound)
			return
		}

		streamID := "skill-" + skillID
		events, err := cfg.EventStore.ReadStream(r.Context(), domain.AdminRealmID, streamID, 0)
		if err != nil || len(events) == 0 {
			http.Error(w, "skill not found", http.StatusNotFound)
			return
		}

		state := domain.RebuildSkillState(events)
		if !state.Exists || state.Deleted {
			http.Error(w, "skill not found", http.StatusNotFound)
			return
		}

		detail := SkillDetail{
			SkillID: state.SkillID,
			Name:    state.Name,
			Content: state.Content,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(detail)
	}
}

func handleUpdateSkill(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		skillID := r.PathValue("id")
		if skillID == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		var req UpdateSkillRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		err := domain.HandleUpdateSkill(r.Context(), domain.UpdateSkill{
			SkillID: skillID,
			Name:    req.Name,
			Content: req.Content,
		}, cfg.EventStore)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				http.Error(w, "skill not found", http.StatusNotFound)
				return
			}
			log.Printf("handleUpdateSkill: failed: %v", err)
			http.Error(w, "failed to update skill", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func handleDeleteSkill(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		skillID := r.PathValue("id")
		if skillID == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		err := domain.HandleDeleteSkill(r.Context(), domain.DeleteSkill{
			SkillID: skillID,
		}, cfg.EventStore)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				http.Error(w, "skill not found", http.StatusNotFound)
				return
			}
			log.Printf("handleDeleteSkill: failed: %v", err)
			http.Error(w, "failed to delete skill", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// --- Workflow Handlers ---

func handleCreateWorkflow(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req CreateWorkflowRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		name := strings.TrimSpace(req.Name)
		if name == "" {
			http.Error(w, "name is required", http.StatusBadRequest)
			return
		}

		result, err := domain.HandleCreateWorkflow(r.Context(), domain.CreateWorkflow{
			Name:    name,
			Content: req.Content,
		}, cfg.EventStore)
		if err != nil {
			log.Printf("handleCreateWorkflow: failed: %v", err)
			http.Error(w, "failed to create workflow", http.StatusInternalServerError)
			return
		}

		resp := CreateWorkflowResponse{
			WorkflowID: result.WorkflowID,
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(resp)
	}
}

func handleListWorkflows(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		workflows := []WorkflowListEntry{}

		if cfg.EventStore != nil {
			events, err := cfg.EventStore.ReadAll(r.Context(), domain.AdminRealmID, 0)
			if err != nil {
				log.Printf("handleListWorkflows: failed to read events: %v", err)
				http.Error(w, "failed to list workflows", http.StatusInternalServerError)
				return
			}

			workflowStates := make(map[string]*domain.WorkflowState)
			for _, evt := range events {
				if evt.StreamID == "" || !strings.HasPrefix(evt.StreamID, "wf-") {
					continue
				}
				workflowID := strings.TrimPrefix(evt.StreamID, "wf-")
				if workflowStates[workflowID] == nil {
					workflowStates[workflowID] = &domain.WorkflowState{}
				}

				switch evt.EventType {
				case domain.EventWorkflowCreated:
					var data domain.WorkflowCreated
					if err := json.Unmarshal(evt.Data, &data); err == nil {
						workflowStates[workflowID].Exists = true
						workflowStates[workflowID].WorkflowID = data.WorkflowID
						workflowStates[workflowID].Name = data.Name
					}
				case domain.EventWorkflowDeleted:
					workflowStates[workflowID].Deleted = true
				}
			}

			for _, state := range workflowStates {
				if state.Exists && !state.Deleted {
					workflows = append(workflows, WorkflowListEntry{
						WorkflowID: state.WorkflowID,
						Name:       state.Name,
					})
				}
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(workflows)
	}
}

func handleGetWorkflow(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		workflowID := r.PathValue("id")
		if workflowID == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		if cfg.EventStore == nil {
			http.Error(w, "workflow not found", http.StatusNotFound)
			return
		}

		streamID := "wf-" + workflowID
		events, err := cfg.EventStore.ReadStream(r.Context(), domain.AdminRealmID, streamID, 0)
		if err != nil || len(events) == 0 {
			http.Error(w, "workflow not found", http.StatusNotFound)
			return
		}

		state := domain.RebuildWorkflowState(events)
		if !state.Exists || state.Deleted {
			http.Error(w, "workflow not found", http.StatusNotFound)
			return
		}

		detail := WorkflowDetail{
			WorkflowID: state.WorkflowID,
			Name:       state.Name,
			Content:    state.Content,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(detail)
	}
}

func handleUpdateWorkflow(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		workflowID := r.PathValue("id")
		if workflowID == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		var req UpdateWorkflowRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		err := domain.HandleUpdateWorkflow(r.Context(), domain.UpdateWorkflow{
			WorkflowID: workflowID,
			Name:       req.Name,
			Content:    req.Content,
		}, cfg.EventStore)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				http.Error(w, "workflow not found", http.StatusNotFound)
				return
			}
			log.Printf("handleUpdateWorkflow: failed: %v", err)
			http.Error(w, "failed to update workflow", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func handleDeleteWorkflow(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		workflowID := r.PathValue("id")
		if workflowID == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		err := domain.HandleDeleteWorkflow(r.Context(), domain.DeleteWorkflow{
			WorkflowID: workflowID,
		}, cfg.EventStore)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				http.Error(w, "workflow not found", http.StatusNotFound)
				return
			}
			log.Printf("handleDeleteWorkflow: failed: %v", err)
			http.Error(w, "failed to delete workflow", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}
