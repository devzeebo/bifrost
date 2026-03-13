package server

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	DBDriver         string        `yaml:"db_driver"`
	DBPath           string        `yaml:"db_path"`
	Port             int           `yaml:"port"`
	CatchUpInterval  time.Duration `yaml:"catchup_interval"`
	ViteDevServerURL string        `yaml:"vite_dev_server_url"`
}

type configFile struct {
	DBDriver        string `yaml:"db_driver"`
	DBPath          string `yaml:"db_path"`
	Port            int    `yaml:"port"`
	CatchUpInterval string `yaml:"catchup_interval"`
}

func LoadConfig() (*Config, error) {
	// Start with defaults
	cfg := &Config{
		DBDriver:        "sqlite",
		DBPath:          "./bifrost.db",
		Port:            8080,
		CatchUpInterval: 1 * time.Second,
	}

	// Load from config file first
	if err := loadConfigFile(cfg); err != nil {
		return nil, fmt.Errorf("load config file: %w", err)
	}

	// Override with environment variables
	if err := applyEnvOverrides(cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}

func loadConfigFile(cfg *Config) error {
	// Check for config file in order of precedence
	configPaths := []string{
		filepath.Join(os.Getenv("HOME"), ".config", "bifrost", "server.yaml"),
		"/etc/bifrost/server.yaml",
	}

	var configData []byte
	var configPath string

	for _, path := range configPaths {
		if data, err := os.ReadFile(path); err == nil {
			configData = data
			configPath = path
			break
		}
	}

	if configData == nil {
		return nil // No config file found, use defaults
	}

	var cf configFile
	if err := yaml.Unmarshal(configData, &cf); err != nil {
		return fmt.Errorf("parse config file %s: %w", configPath, err)
	}

	// Apply config file values
	if cf.DBDriver != "" {
		cfg.DBDriver = cf.DBDriver
	}
	if cf.DBPath != "" {
		cfg.DBPath = cf.DBPath
	}
	if cf.Port > 0 {
		cfg.Port = cf.Port
	}
	if cf.CatchUpInterval != "" {
		d, err := time.ParseDuration(cf.CatchUpInterval)
		if err != nil {
			return fmt.Errorf("parse catchup_interval: %w", err)
		}
		cfg.CatchUpInterval = d
	}

	return nil
}

func applyEnvOverrides(cfg *Config) error {
	if dbDriver := os.Getenv("BIFROST_DB_DRIVER"); dbDriver != "" {
		cfg.DBDriver = dbDriver
	}

	// Validate DB driver
	if cfg.DBDriver != "sqlite" && cfg.DBDriver != "postgres" && cfg.DBDriver != "psql" {
		return fmt.Errorf("unsupported DB driver: %q (must be 'sqlite', 'postgres', or 'psql')", cfg.DBDriver)
	}

	// Normalize postgres driver names
	if cfg.DBDriver == "psql" {
		cfg.DBDriver = "postgres"
	}

	if dbPath := os.Getenv("BIFROST_DB_PATH"); dbPath != "" {
		cfg.DBPath = dbPath
	}

	if portStr := os.Getenv("BIFROST_PORT"); portStr != "" {
		p, err := strconv.Atoi(portStr)
		if err != nil {
			return fmt.Errorf("BIFROST_PORT must be a valid integer: %w", err)
		}
		if p < 1 || p > 65535 {
			return fmt.Errorf("BIFROST_PORT must be between 1 and 65535")
		}
		cfg.Port = p
	}

	if intervalStr := os.Getenv("BIFROST_CATCHUP_INTERVAL"); intervalStr != "" {
		d, err := time.ParseDuration(intervalStr)
		if err != nil {
			return fmt.Errorf("BIFROST_CATCHUP_INTERVAL must be a valid duration: %w", err)
		}
		cfg.CatchUpInterval = d
	}

	if url := os.Getenv("BIFROST_VITE_DEV_SERVER_URL"); url != "" {
		cfg.ViteDevServerURL = url
	}

	// Set default DB path based on driver if still at default
	if cfg.DBPath == "./bifrost.db" && cfg.DBDriver == "postgres" {
		cfg.DBPath = "postgres://localhost/bifrost?sslmode=disable"
	}

	return nil
}
