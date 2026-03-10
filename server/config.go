package server

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	DBDriver         string
	DBPath           string
	Port             int
	CatchUpInterval  time.Duration
	ViteDevServerURL string // URL of Vite dev server (development mode, e.g., "http://localhost:3000")
	UIProxyURL       string // URL of Vike production server (e.g., "http://ui:3000")
}

func LoadConfig() (*Config, error) {
	dbDriver := os.Getenv("BIFROST_DB_DRIVER")
	if dbDriver == "" {
		dbDriver = "sqlite"
	}

	// Validate DB driver
	if dbDriver != "sqlite" && dbDriver != "postgres" && dbDriver != "psql" {
		return nil, fmt.Errorf("unsupported DB driver: %q (must be 'sqlite', 'postgres', or 'psql')", dbDriver)
	}

	// Normalize postgres driver names
	if dbDriver == "psql" {
		dbDriver = "postgres"
	}

	dbPath := os.Getenv("BIFROST_DB_PATH")
	if dbPath == "" {
		if dbDriver == "postgres" {
			dbPath = "postgres://localhost/bifrost?sslmode=disable"
		} else {
			dbPath = "./bifrost.db"
		}
	}

	port := 8080
	if portStr := os.Getenv("BIFROST_PORT"); portStr != "" {
		p, err := strconv.Atoi(portStr)
		if err != nil {
			return nil, fmt.Errorf("BIFROST_PORT must be a valid integer: %w", err)
		}
		if p < 1 || p > 65535 {
			return nil, fmt.Errorf("BIFROST_PORT must be between 1 and 65535")
		}
		port = p
	}

	catchUpInterval := 1 * time.Second
	if intervalStr := os.Getenv("BIFROST_CATCHUP_INTERVAL"); intervalStr != "" {
		d, err := time.ParseDuration(intervalStr)
		if err != nil {
			return nil, fmt.Errorf("BIFROST_CATCHUP_INTERVAL must be a valid duration: %w", err)
		}
		catchUpInterval = d
	}

	return &Config{
		DBDriver:         dbDriver,
		DBPath:           dbPath,
		Port:             port,
		CatchUpInterval:  catchUpInterval,
		ViteDevServerURL: os.Getenv("BIFROST_VITE_DEV_SERVER_URL"),
		UIProxyURL:       os.Getenv("BIFROST_UI_PROXY_URL"),
	}, nil
}
