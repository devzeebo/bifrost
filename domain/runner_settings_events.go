package domain

const (
	EventRunnerSettingsCreated      = "RunnerSettingsCreated"
	EventRunnerSettingsFieldSet     = "RunnerSettingsFieldSet"
	EventRunnerSettingsFieldDeleted = "RunnerSettingsFieldDeleted"
	EventRunnerSettingsDeleted      = "RunnerSettingsDeleted"
)

type RunnerSettingsCreated struct {
	RunnerSettingsID string `json:"runner_settings_id"`
	RunnerType       string `json:"runner_type"`
	Name             string `json:"name"`
}

type RunnerSettingsFieldSet struct {
	RunnerSettingsID string `json:"runner_settings_id"`
	Key              string `json:"key"`
	Value            string `json:"value"`
}

type RunnerSettingsFieldDeleted struct {
	RunnerSettingsID string `json:"runner_settings_id"`
	Key              string `json:"key"`
}

type RunnerSettingsDeleted struct {
	RunnerSettingsID string `json:"runner_settings_id"`
}
