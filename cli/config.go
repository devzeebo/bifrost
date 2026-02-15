package cli

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

type Config struct {
	URL      string   `mapstructure:"url"`
	APIKey   string   `mapstructure:"api_key"`
	Realm    string   `mapstructure:"realm"`
	Warnings []string `mapstructure:"-"`
}

func LoadConfig(workDir, homeDir string) (*Config, error) {
	v := viper.New()

	v.SetDefault("url", "http://localhost:8080")

	v.SetConfigName(".bifrost")
	v.SetConfigType("yaml")

	// Walk upward from workDir looking for .bifrost.yaml, stopping at
	// filesystem root or when a .git directory is found in the current dir.
	dir := workDir
	for {
		// Check for .bifrost.yaml in this directory
		configPath := filepath.Join(dir, ".bifrost.yaml")
		if _, err := os.Stat(configPath); err == nil {
			v.AddConfigPath(dir)
			break
		}

		// Check for .git boundary — stop walking if found
		gitPath := filepath.Join(dir, ".git")
		if _, err := os.Stat(gitPath); err == nil {
			break
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			// Reached filesystem root
			break
		}
		dir = parent
	}

	// Always add homeDir as fallback (lowest file priority)
	v.AddConfigPath(homeDir)

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("reading config file: %w", err)
		}
	}

	v.SetEnvPrefix("BIFROST")
	v.AutomaticEnv()

	v.BindEnv("url", "BIFROST_URL")
	v.BindEnv("api_key", "BIFROST_API_KEY")

	cfg := &Config{}
	if err := v.Unmarshal(cfg); err != nil {
		return nil, fmt.Errorf("parsing config: %w", err)
	}

	// Token resolution: 1. credential store, 2. api_key in yaml (deprecated), 3. BIFROST_API_KEY env (deprecated)
	token, credErr := GetCredential(homeDir, cfg.URL)
	if credErr == nil && token != "" {
		cfg.APIKey = token
	} else if cfg.APIKey != "" {
		cfg.Warnings = append(cfg.Warnings, "Warning: api_key in .bifrost.yaml is deprecated. Use bf login instead.")
	} else {
		return nil, fmt.Errorf("no credentials found, run bf login to authenticate")
	}

	if cfg.Realm == "" {
		return nil, fmt.Errorf("realm is required in .bifrost.yaml")
	}

	return cfg, nil
}
