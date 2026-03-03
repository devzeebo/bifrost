package admin

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestAgentsAPI_CreateAgent(t *testing.T) {
	t.Run("creates agent with valid data", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.valid_create_agent_request()
		tc.admin_auth_configured()

		// When
		tc.create_agent_request_is_made()

		// Then
		tc.status_is_created()
		tc.response_contains_agent_id()
	})

	t.Run("returns bad request for empty name", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.create_agent_request_with_empty_name()
		tc.admin_auth_configured()

		// When
		tc.create_agent_request_is_made()

		// Then
		tc.status_is_bad_request()
	})
}

func TestAgentsAPI_ListAgents(t *testing.T) {
	t.Run("returns empty list when no agents exist", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()

		// When
		tc.list_agents_request_is_made()

		// Then
		tc.status_is_ok()
		tc.response_is_empty_list()
	})

	t.Run("returns list of agents", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.agent_exists_in_store("agent-001", "Test Agent")

		// When
		tc.list_agents_request_is_made()

		// Then
		tc.status_is_ok()
		tc.response_contains_agents()
	})
}

func TestAgentsAPI_GetAgent(t *testing.T) {
	t.Run("returns agent details", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.agent_exists_in_store("agent-001", "Test Agent")

		// When
		tc.get_agent_request_is_made("agent-001")

		// Then
		tc.status_is_ok()
		tc.response_contains_agent_details()
	})

	t.Run("returns not found for non-existent agent", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()

		// When
		tc.get_agent_request_is_made("agent-nonexistent")

		// Then
		tc.status_is_not_found()
	})
}

func TestAgentsAPI_UpdateAgent(t *testing.T) {
	t.Run("updates agent name", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.agent_exists_in_store("agent-001", "Old Name")
		tc.valid_update_agent_request("agent-001")

		// When
		tc.update_agent_request_is_made()

		// Then
		tc.status_is_no_content()
	})

	t.Run("returns not found for non-existent agent", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.valid_update_agent_request("agent-nonexistent")

		// When
		tc.update_agent_request_is_made()

		// Then
		tc.status_is_not_found()
	})
}

func TestAgentsAPI_GrantRealm(t *testing.T) {
	t.Run("grants realm access to agent", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.agent_exists_in_store("agent-001", "Test Agent")
		tc.valid_grant_realm_request("agent-001", "realm-001")

		// When
		tc.grant_realm_request_is_made()

		// Then
		tc.status_is_no_content()
	})

	t.Run("returns not found for non-existent agent", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.valid_grant_realm_request("agent-nonexistent", "realm-001")

		// When
		tc.grant_realm_request_is_made()

		// Then
		tc.status_is_not_found()
	})
}

func TestAgentsAPI_RevokeRealm(t *testing.T) {
	t.Run("revokes realm access from agent", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.agent_exists_in_store_with_realm("agent-001", "Test Agent", "realm-001")
		tc.valid_revoke_realm_request("agent-001", "realm-001")

		// When
		tc.revoke_realm_request_is_made()

		// Then
		tc.status_is_no_content()
	})

	t.Run("returns bad request when realm not granted", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.agent_exists_in_store("agent-001", "Test Agent")
		tc.valid_revoke_realm_request("agent-001", "realm-not-granted")

		// When
		tc.revoke_realm_request_is_made()

		// Then
		tc.status_is_bad_request()
	})
}

func TestSkillsAPI_CreateSkill(t *testing.T) {
	t.Run("creates skill with valid data", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.valid_create_skill_request()
		tc.admin_auth_configured()

		// When
		tc.create_skill_request_is_made()

		// Then
		tc.status_is_created()
		tc.response_contains_skill_id()
	})

	t.Run("returns bad request for empty name", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.create_skill_request_with_empty_name()
		tc.admin_auth_configured()

		// When
		tc.create_skill_request_is_made()

		// Then
		tc.status_is_bad_request()
	})
}

func TestSkillsAPI_ListSkills(t *testing.T) {
	t.Run("returns empty list when no skills exist", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()

		// When
		tc.list_skills_request_is_made()

		// Then
		tc.status_is_ok()
		tc.response_is_empty_list()
	})

	t.Run("returns list of skills", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.skill_exists_in_store("skill-001", "Test Skill")

		// When
		tc.list_skills_request_is_made()

		// Then
		tc.status_is_ok()
		tc.response_contains_skills()
	})
}

func TestSkillsAPI_GetSkill(t *testing.T) {
	t.Run("returns skill details", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.skill_exists_in_store("skill-001", "Test Skill")

		// When
		tc.get_skill_request_is_made("skill-001")

		// Then
		tc.status_is_ok()
		tc.response_contains_skill_details()
	})

	t.Run("returns not found for non-existent skill", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()

		// When
		tc.get_skill_request_is_made("skill-nonexistent")

		// Then
		tc.status_is_not_found()
	})
}

func TestSkillsAPI_UpdateSkill(t *testing.T) {
	t.Run("updates skill name", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.skill_exists_in_store("skill-001", "Old Name")
		tc.valid_update_skill_request("skill-001")

		// When
		tc.update_skill_request_is_made()

		// Then
		tc.status_is_no_content()
	})

	t.Run("returns not found for non-existent skill", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.valid_update_skill_request("skill-nonexistent")

		// When
		tc.update_skill_request_is_made()

		// Then
		tc.status_is_not_found()
	})
}

func TestSkillsAPI_DeleteSkill(t *testing.T) {
	t.Run("deletes existing skill", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.skill_exists_in_store("skill-001", "Test Skill")

		// When
		tc.delete_skill_request_is_made("skill-001")

		// Then
		tc.status_is_no_content()
	})

	t.Run("returns not found for non-existent skill", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()

		// When
		tc.delete_skill_request_is_made("skill-nonexistent")

		// Then
		tc.status_is_not_found()
	})
}

func TestWorkflowsAPI_CreateWorkflow(t *testing.T) {
	t.Run("creates workflow with valid data", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.valid_create_workflow_request()
		tc.admin_auth_configured()

		// When
		tc.create_workflow_request_is_made()

		// Then
		tc.status_is_created()
		tc.response_contains_workflow_id()
	})

	t.Run("returns bad request for empty name", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.create_workflow_request_with_empty_name()
		tc.admin_auth_configured()

		// When
		tc.create_workflow_request_is_made()

		// Then
		tc.status_is_bad_request()
	})
}

func TestWorkflowsAPI_ListWorkflows(t *testing.T) {
	t.Run("returns empty list when no workflows exist", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()

		// When
		tc.list_workflows_request_is_made()

		// Then
		tc.status_is_ok()
		tc.response_is_empty_list()
	})

	t.Run("returns list of workflows", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.workflow_exists_in_store("wf-001", "Test Workflow")

		// When
		tc.list_workflows_request_is_made()

		// Then
		tc.status_is_ok()
		tc.response_contains_workflows()
	})
}

func TestWorkflowsAPI_GetWorkflow(t *testing.T) {
	t.Run("returns workflow details", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.workflow_exists_in_store("wf-001", "Test Workflow")

		// When
		tc.get_workflow_request_is_made("wf-001")

		// Then
		tc.status_is_ok()
		tc.response_contains_workflow_details()
	})

	t.Run("returns not found for non-existent workflow", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()

		// When
		tc.get_workflow_request_is_made("wf-nonexistent")

		// Then
		tc.status_is_not_found()
	})
}

func TestWorkflowsAPI_UpdateWorkflow(t *testing.T) {
	t.Run("updates workflow name", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.workflow_exists_in_store("wf-001", "Old Name")
		tc.valid_update_workflow_request("wf-001")

		// When
		tc.update_workflow_request_is_made()

		// Then
		tc.status_is_no_content()
	})

	t.Run("returns not found for non-existent workflow", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.valid_update_workflow_request("wf-nonexistent")

		// When
		tc.update_workflow_request_is_made()

		// Then
		tc.status_is_not_found()
	})
}

func TestWorkflowsAPI_DeleteWorkflow(t *testing.T) {
	t.Run("deletes existing workflow", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.workflow_exists_in_store("wf-001", "Test Workflow")

		// When
		tc.delete_workflow_request_is_made("wf-001")

		// Then
		tc.status_is_no_content()
	})

	t.Run("returns not found for non-existent workflow", func(t *testing.T) {
		tc := newAgentsTestContext(t)

		// Given
		tc.admin_auth_configured()

		// When
		tc.delete_workflow_request_is_made("wf-nonexistent")

		// Then
		tc.status_is_not_found()
	})
}

// --- Test Context ---

type agentsTestContext struct {
	t        *testing.T
	mux      *http.ServeMux
	recorder *httptest.ResponseRecorder
	store    *mockEventStore
	cfg      *RouteConfig
	validJWT string

	// Request data
	requestBody []byte
	agentID     string
	skillID     string
	workflowID  string
}

func newAgentsTestContext(t *testing.T) *agentsTestContext {
	t.Helper()

	store := newMockEventStore()
	projStore := newMockProjectionStore()
	cfg := &RouteConfig{
		AuthConfig:      DefaultAuthConfig(),
		ProjectionStore: projStore,
		EventStore:      store,
	}

	// Generate signing key
	cfg.AuthConfig.SigningKey = make([]byte, 32)
	_, err := rand.Read(cfg.AuthConfig.SigningKey)
	require.NoError(t, err, "failed to generate signing key")

	// Create a valid JWT for authenticated requests
	projStore.data[compositeKey("_admin", "account_lookup", "pat:pat-test-123")] = "keyhash-test"
	projStore.data[compositeKey("_admin", "account_lookup", "keyhash-test")] = projectors.AccountLookupEntry{
		AccountID: "account-test-123",
		Username:  "testuser",
		Status:    "active",
		Roles:     map[string]string{"_admin": "admin"},
	}

	validJWT, err := GenerateJWT(cfg.AuthConfig, "account-test-123", "pat-test-123")
	require.NoError(t, err, "failed to generate JWT")

	mux := http.NewServeMux()
	RegisterAgentsAPIRoutes(mux, cfg)

	return &agentsTestContext{
		t:        t,
		mux:      mux,
		recorder: httptest.NewRecorder(),
		store:    store,
		cfg:      cfg,
		validJWT: validJWT,
	}
}

// --- Given ---

func (tc *agentsTestContext) admin_auth_configured() {
	tc.t.Helper()
	// Already configured in newAgentsTestContext
}

func (tc *agentsTestContext) valid_create_agent_request() {
	tc.t.Helper()
	req := map[string]interface{}{
		"name": "Test Agent",
	}
	tc.requestBody, _ = json.Marshal(req)
}

func (tc *agentsTestContext) create_agent_request_with_empty_name() {
	tc.t.Helper()
	req := map[string]interface{}{
		"name": "",
	}
	tc.requestBody, _ = json.Marshal(req)
}

func (tc *agentsTestContext) valid_create_skill_request() {
	tc.t.Helper()
	req := map[string]interface{}{
		"name":    "Test Skill",
		"content": "skill content here",
	}
	tc.requestBody, _ = json.Marshal(req)
}

func (tc *agentsTestContext) create_skill_request_with_empty_name() {
	tc.t.Helper()
	req := map[string]interface{}{
		"name":    "",
		"content": "skill content here",
	}
	tc.requestBody, _ = json.Marshal(req)
}

func (tc *agentsTestContext) valid_create_workflow_request() {
	tc.t.Helper()
	req := map[string]interface{}{
		"name":    "Test Workflow",
		"content": "workflow content here",
	}
	tc.requestBody, _ = json.Marshal(req)
}

func (tc *agentsTestContext) create_workflow_request_with_empty_name() {
	tc.t.Helper()
	req := map[string]interface{}{
		"name":    "",
		"content": "workflow content here",
	}
	tc.requestBody, _ = json.Marshal(req)
}

func (tc *agentsTestContext) valid_update_agent_request(agentID string) {
	tc.t.Helper()
	tc.agentID = agentID
	req := map[string]interface{}{
		"name": "Updated Name",
	}
	tc.requestBody, _ = json.Marshal(req)
}

func (tc *agentsTestContext) valid_update_skill_request(skillID string) {
	tc.t.Helper()
	tc.skillID = skillID
	req := map[string]interface{}{
		"name": "Updated Skill Name",
	}
	tc.requestBody, _ = json.Marshal(req)
}

func (tc *agentsTestContext) valid_update_workflow_request(workflowID string) {
	tc.t.Helper()
	tc.workflowID = workflowID
	req := map[string]interface{}{
		"name": "Updated Workflow Name",
	}
	tc.requestBody, _ = json.Marshal(req)
}

func (tc *agentsTestContext) valid_grant_realm_request(agentID, realmID string) {
	tc.t.Helper()
	tc.agentID = agentID
	req := map[string]interface{}{
		"realm_id": realmID,
	}
	tc.requestBody, _ = json.Marshal(req)
}

func (tc *agentsTestContext) valid_revoke_realm_request(agentID, realmID string) {
	tc.t.Helper()
	tc.agentID = agentID
	tc.requestBody, _ = json.Marshal(map[string]interface{}{
		"realm_id": realmID,
	})
}

func (tc *agentsTestContext) agent_exists_in_store(agentID, name string) {
	tc.t.Helper()
	// Add agent created event to store
	data := map[string]interface{}{
		"agent_id": agentID,
		"name":     name,
	}
	dataBytes, _ := json.Marshal(data)
	tc.store.streams["_admin|agent-"+agentID] = []core.Event{
		{
			RealmID:   "_admin",
			StreamID:  "agent-" + agentID,
			Version:   0,
			EventType: "AgentCreated",
			Data:      dataBytes,
		},
	}
}

func (tc *agentsTestContext) agent_exists_in_store_with_realm(agentID, name, realmID string) {
	tc.t.Helper()
	tc.agent_exists_in_store(agentID, name)
	// Add realm granted event
	data := map[string]interface{}{
		"agent_id": agentID,
		"realm_id": realmID,
	}
	dataBytes, _ := json.Marshal(data)
	tc.store.streams["_admin|agent-"+agentID] = append(tc.store.streams["_admin|agent-"+agentID], core.Event{
		RealmID:   "_admin",
		StreamID:  "agent-" + agentID,
		Version:   1,
		EventType: "AgentRealmGranted",
		Data:      dataBytes,
	})
}

func (tc *agentsTestContext) skill_exists_in_store(skillID, name string) {
	tc.t.Helper()
	data := map[string]interface{}{
		"skill_id": skillID,
		"name":     name,
		"content":  "test content",
	}
	dataBytes, _ := json.Marshal(data)
	tc.store.streams["_admin|skill-"+skillID] = []core.Event{
		{
			RealmID:   "_admin",
			StreamID:  "skill-" + skillID,
			Version:   0,
			EventType: "SkillCreated",
			Data:      dataBytes,
		},
	}
}

func (tc *agentsTestContext) workflow_exists_in_store(workflowID, name string) {
	tc.t.Helper()
	data := map[string]interface{}{
		"workflow_id": workflowID,
		"name":        name,
		"content":     "test content",
	}
	dataBytes, _ := json.Marshal(data)
	tc.store.streams["_admin|wf-"+workflowID] = []core.Event{
		{
			RealmID:   "_admin",
			StreamID:  "wf-" + workflowID,
			Version:   0,
			EventType: "WorkflowCreated",
			Data:      dataBytes,
		},
	}
}

// --- When ---

func (tc *agentsTestContext) create_agent_request_is_made() {
	tc.t.Helper()
	req := httptest.NewRequest("POST", "/admin/agents", bytes.NewReader(tc.requestBody))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *agentsTestContext) list_agents_request_is_made() {
	tc.t.Helper()
	req := httptest.NewRequest("GET", "/admin/agents", nil)
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *agentsTestContext) get_agent_request_is_made(agentID string) {
	tc.t.Helper()
	req := httptest.NewRequest("GET", "/admin/agents/"+agentID, nil)
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *agentsTestContext) update_agent_request_is_made() {
	tc.t.Helper()
	req := httptest.NewRequest("PUT", "/admin/agents/"+tc.agentID, bytes.NewReader(tc.requestBody))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *agentsTestContext) grant_realm_request_is_made() {
	tc.t.Helper()
	req := httptest.NewRequest("POST", "/admin/agents/"+tc.agentID+"/realms", bytes.NewReader(tc.requestBody))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *agentsTestContext) revoke_realm_request_is_made() {
	tc.t.Helper()
	req := httptest.NewRequest("DELETE", "/admin/agents/"+tc.agentID+"/realms/realm-001", nil)
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *agentsTestContext) create_skill_request_is_made() {
	tc.t.Helper()
	req := httptest.NewRequest("POST", "/admin/skills", bytes.NewReader(tc.requestBody))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *agentsTestContext) list_skills_request_is_made() {
	tc.t.Helper()
	req := httptest.NewRequest("GET", "/admin/skills", nil)
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *agentsTestContext) get_skill_request_is_made(skillID string) {
	tc.t.Helper()
	req := httptest.NewRequest("GET", "/admin/skills/"+skillID, nil)
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *agentsTestContext) update_skill_request_is_made() {
	tc.t.Helper()
	req := httptest.NewRequest("PUT", "/admin/skills/"+tc.skillID, bytes.NewReader(tc.requestBody))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *agentsTestContext) delete_skill_request_is_made(skillID string) {
	tc.t.Helper()
	req := httptest.NewRequest("DELETE", "/admin/skills/"+skillID, nil)
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *agentsTestContext) create_workflow_request_is_made() {
	tc.t.Helper()
	req := httptest.NewRequest("POST", "/admin/workflows", bytes.NewReader(tc.requestBody))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *agentsTestContext) list_workflows_request_is_made() {
	tc.t.Helper()
	req := httptest.NewRequest("GET", "/admin/workflows", nil)
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *agentsTestContext) get_workflow_request_is_made(workflowID string) {
	tc.t.Helper()
	req := httptest.NewRequest("GET", "/admin/workflows/"+workflowID, nil)
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *agentsTestContext) update_workflow_request_is_made() {
	tc.t.Helper()
	req := httptest.NewRequest("PUT", "/admin/workflows/"+tc.workflowID, bytes.NewReader(tc.requestBody))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *agentsTestContext) delete_workflow_request_is_made(workflowID string) {
	tc.t.Helper()
	req := httptest.NewRequest("DELETE", "/admin/workflows/"+workflowID, nil)
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

// --- Then ---

func (tc *agentsTestContext) status_is_created() {
	tc.t.Helper()
	assert.Equal(tc.t, http.StatusCreated, tc.recorder.Code)
}

func (tc *agentsTestContext) status_is_ok() {
	tc.t.Helper()
	assert.Equal(tc.t, http.StatusOK, tc.recorder.Code)
}

func (tc *agentsTestContext) status_is_no_content() {
	tc.t.Helper()
	assert.Equal(tc.t, http.StatusNoContent, tc.recorder.Code)
}

func (tc *agentsTestContext) status_is_bad_request() {
	tc.t.Helper()
	assert.Equal(tc.t, http.StatusBadRequest, tc.recorder.Code)
}

func (tc *agentsTestContext) status_is_not_found() {
	tc.t.Helper()
	assert.Equal(tc.t, http.StatusNotFound, tc.recorder.Code)
}

func (tc *agentsTestContext) response_contains_agent_id() {
	tc.t.Helper()
	var resp map[string]interface{}
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err)
	assert.NotEmpty(tc.t, resp["agent_id"])
}

func (tc *agentsTestContext) response_contains_skill_id() {
	tc.t.Helper()
	var resp map[string]interface{}
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err)
	assert.NotEmpty(tc.t, resp["skill_id"])
}

func (tc *agentsTestContext) response_contains_workflow_id() {
	tc.t.Helper()
	var resp map[string]interface{}
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err)
	assert.NotEmpty(tc.t, resp["workflow_id"])
}

func (tc *agentsTestContext) response_is_empty_list() {
	tc.t.Helper()
	var resp []interface{}
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err)
	assert.Empty(tc.t, resp)
}

func (tc *agentsTestContext) response_contains_agents() {
	tc.t.Helper()
	var resp []map[string]interface{}
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err)
	assert.NotEmpty(tc.t, resp)
}

func (tc *agentsTestContext) response_contains_agent_details() {
	tc.t.Helper()
	var resp map[string]interface{}
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err)
	assert.NotEmpty(tc.t, resp["agent_id"])
	assert.NotEmpty(tc.t, resp["name"])
}

func (tc *agentsTestContext) response_contains_skills() {
	tc.t.Helper()
	var resp []map[string]interface{}
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err)
	assert.NotEmpty(tc.t, resp)
}

func (tc *agentsTestContext) response_contains_skill_details() {
	tc.t.Helper()
	var resp map[string]interface{}
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err)
	assert.NotEmpty(tc.t, resp["skill_id"])
	assert.NotEmpty(tc.t, resp["name"])
}

func (tc *agentsTestContext) response_contains_workflows() {
	tc.t.Helper()
	var resp []map[string]interface{}
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err)
	assert.NotEmpty(tc.t, resp)
}

func (tc *agentsTestContext) response_contains_workflow_details() {
	tc.t.Helper()
	var resp map[string]interface{}
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err)
	assert.NotEmpty(tc.t, resp["workflow_id"])
	assert.NotEmpty(tc.t, resp["name"])
}
