package domain

type CreateRunnerSettings struct {
	RunnerType string `json:"runner_type"`
	Name       string `json:"name"`
}

type SetRunnerSettingsField struct {
	RunnerSettingsID string `json:"runner_settings_id"`
	Key              string `json:"key"`
	Value            string `json:"value"`
}

type DeleteRunnerSettingsField struct {
	RunnerSettingsID string `json:"runner_settings_id"`
	Key              string `json:"key"`
}

type DeleteRunnerSettings struct {
	RunnerSettingsID string `json:"runner_settings_id"`
}

type CreateRunnerSettingsResult struct {
	RunnerSettingsID string `json:"runner_settings_id"`
}
