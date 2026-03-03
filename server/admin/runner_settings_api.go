package admin

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/devzeebo/bifrost/domain"
)

// RunnerSettingsListEntry is the JSON response for a runner settings entry in the list.
type RunnerSettingsListEntry struct {
	RunnerSettingsID string `json:"runner_settings_id"`
	RunnerType       string `json:"runner_type"`
	Name             string `json:"name"`
}

// RunnerSettingsDetail is the JSON response for a single runner settings.
type RunnerSettingsDetail struct {
	RunnerSettingsID string            `json:"runner_settings_id"`
	RunnerType       string            `json:"runner_type"`
	Name             string            `json:"name"`
	Fields           map[string]string `json:"fields,omitempty"`
}

// CreateRunnerSettingsRequest is the request body for POST /admin/runner-settings.
type CreateRunnerSettingsRequest struct {
	RunnerType string `json:"runner_type"`
	Name       string `json:"name"`
}

// CreateRunnerSettingsResponse is the response for POST /admin/runner-settings.
type CreateRunnerSettingsResponse struct {
	RunnerSettingsID string `json:"runner_settings_id"`
}

// SetRunnerSettingsFieldRequest is the request body for POST /admin/runner-settings/{id}/fields.
type SetRunnerSettingsFieldRequest struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// RegisterRunnerSettingsAPIRoutes registers the runner settings JSON API routes.
func RegisterRunnerSettingsAPIRoutes(mux *http.ServeMux, cfg *RouteConfig) {
	authMiddleware := AuthMiddleware(cfg.AuthConfig, cfg.ProjectionStore)
	requireAdmin := RequireAdminMiddleware()

	mux.Handle("POST /admin/runner-settings", authMiddleware(requireAdmin(http.HandlerFunc(handleCreateRunnerSettings(cfg)))))
	mux.Handle("GET /admin/runner-settings", authMiddleware(requireAdmin(http.HandlerFunc(handleListRunnerSettings(cfg)))))
	mux.Handle("GET /admin/runner-settings/{id}", authMiddleware(requireAdmin(http.HandlerFunc(handleGetRunnerSettings(cfg)))))
	mux.Handle("PUT /admin/runner-settings/{id}", authMiddleware(requireAdmin(http.HandlerFunc(handleUpdateRunnerSettings(cfg)))))
	mux.Handle("DELETE /admin/runner-settings/{id}", authMiddleware(requireAdmin(http.HandlerFunc(handleDeleteRunnerSettings(cfg)))))
	mux.Handle("POST /admin/runner-settings/{id}/fields", authMiddleware(requireAdmin(http.HandlerFunc(handleSetRunnerSettingsField(cfg)))))
}

func handleCreateRunnerSettings(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req CreateRunnerSettingsRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		runnerType := strings.TrimSpace(req.RunnerType)
		if runnerType == "" {
			http.Error(w, "runner_type is required", http.StatusBadRequest)
			return
		}

		name := strings.TrimSpace(req.Name)
		if name == "" {
			http.Error(w, "name is required", http.StatusBadRequest)
			return
		}

		result, err := domain.HandleCreateRunnerSettings(r.Context(), domain.CreateRunnerSettings{
			RunnerType: runnerType,
			Name:       name,
		}, cfg.EventStore)
		if err != nil {
			log.Printf("handleCreateRunnerSettings: failed: %v", err)
			http.Error(w, "failed to create runner settings", http.StatusInternalServerError)
			return
		}

		resp := CreateRunnerSettingsResponse{
			RunnerSettingsID: result.RunnerSettingsID,
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(resp)
	}
}

func handleListRunnerSettings(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		settings := []RunnerSettingsListEntry{}

		if cfg.EventStore != nil {
			events, err := cfg.EventStore.ReadAll(r.Context(), domain.AdminRealmID, 0)
			if err != nil {
				log.Printf("handleListRunnerSettings: failed to read events: %v", err)
				http.Error(w, "failed to list runner settings", http.StatusInternalServerError)
				return
			}

			rsStates := make(map[string]*domain.RunnerSettingsState)
			for _, evt := range events {
				if evt.StreamID == "" || !strings.HasPrefix(evt.StreamID, "rs-") {
					continue
				}
				rsID := strings.TrimPrefix(evt.StreamID, "rs-")
				if rsStates[rsID] == nil {
					rsStates[rsID] = &domain.RunnerSettingsState{}
					rsStates[rsID].Fields = make(map[string]string)
				}

				switch evt.EventType {
				case domain.EventRunnerSettingsCreated:
					var data domain.RunnerSettingsCreated
					if err := json.Unmarshal(evt.Data, &data); err == nil {
						rsStates[rsID].Exists = true
						rsStates[rsID].RunnerSettingsID = data.RunnerSettingsID
						rsStates[rsID].RunnerType = data.RunnerType
						rsStates[rsID].Name = data.Name
					}
				case domain.EventRunnerSettingsDeleted:
					rsStates[rsID].Deleted = true
				}
			}

			for _, state := range rsStates {
				if state.Exists && !state.Deleted {
					settings = append(settings, RunnerSettingsListEntry{
						RunnerSettingsID: state.RunnerSettingsID,
						RunnerType:       state.RunnerType,
						Name:             state.Name,
					})
				}
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(settings)
	}
}

func handleGetRunnerSettings(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rsID := r.PathValue("id")
		if rsID == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		if cfg.EventStore == nil {
			http.Error(w, "runner settings not found", http.StatusNotFound)
			return
		}

		streamID := "rs-" + rsID
		events, err := cfg.EventStore.ReadStream(r.Context(), domain.AdminRealmID, streamID, 0)
		if err != nil || len(events) == 0 {
			http.Error(w, "runner settings not found", http.StatusNotFound)
			return
		}

		state := domain.RebuildRunnerSettingsState(events)
		if !state.Exists || state.Deleted {
			http.Error(w, "runner settings not found", http.StatusNotFound)
			return
		}

		// Decrypt any encrypted field values
		fields := make(map[string]string)
		for key, value := range state.Fields {
			if strings.HasPrefix(value, "encrypted:") && cfg.EncryptionService != nil {
				decrypted, err := cfg.EncryptionService.Decrypt(value)
				if err != nil {
					log.Printf("handleGetRunnerSettings: failed to decrypt field %s: %v", key, err)
					fields[key] = value // Return as-is if decryption fails
				} else {
					fields[key] = decrypted
				}
			} else {
				fields[key] = value
			}
		}

		detail := RunnerSettingsDetail{
			RunnerSettingsID: state.RunnerSettingsID,
			RunnerType:       state.RunnerType,
			Name:             state.Name,
			Fields:           fields,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(detail)
	}
}

func handleUpdateRunnerSettings(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Note: The domain doesn't have an UpdateRunnerSettings handler.
		// Runner settings are updated via field operations only.
		http.Error(w, "not implemented", http.StatusNotImplemented)
	}
}

func handleDeleteRunnerSettings(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rsID := r.PathValue("id")
		if rsID == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		err := domain.HandleDeleteRunnerSettings(r.Context(), domain.DeleteRunnerSettings{
			RunnerSettingsID: rsID,
		}, cfg.EventStore)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				http.Error(w, "runner settings not found", http.StatusNotFound)
				return
			}
			log.Printf("handleDeleteRunnerSettings: failed: %v", err)
			http.Error(w, "failed to delete runner settings", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func handleSetRunnerSettingsField(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rsID := r.PathValue("id")
		if rsID == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		var req SetRunnerSettingsFieldRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		key := strings.TrimSpace(req.Key)
		if key == "" {
			http.Error(w, "key is required", http.StatusBadRequest)
			return
		}

		value := req.Value

		// Check if value should be encrypted
		if strings.HasPrefix(value, "encrypted:") && cfg.EncryptionService != nil {
			// Extract the plaintext after "encrypted:" prefix
			plaintext := strings.TrimPrefix(value, "encrypted:")
			encrypted, err := cfg.EncryptionService.Encrypt(plaintext)
			if err != nil {
				log.Printf("handleSetRunnerSettingsField: failed to encrypt: %v", err)
				http.Error(w, "failed to encrypt field value", http.StatusInternalServerError)
				return
			}
			value = encrypted
		}

		err := domain.HandleSetRunnerSettingsField(r.Context(), domain.SetRunnerSettingsField{
			RunnerSettingsID: rsID,
			Key:              key,
			Value:            value,
		}, cfg.EventStore)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				http.Error(w, "runner settings not found", http.StatusNotFound)
				return
			}
			log.Printf("handleSetRunnerSettingsField: failed: %v", err)
			http.Error(w, "failed to set field", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}
