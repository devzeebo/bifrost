package server

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	DBDriver          string
	DBPath            string
	Port              int
	CatchUpInterval   time.Duration
	AdminUIStaticPath string // Path to built Vike assets (production mode)
	ViteDevServerURL  string // URL of Vite dev server (development mode, e.g., "http://localhost:3000")
}

func LoadConfig() (*Config, error) {
	dbDriver := os.Getenv("BIFROST_DB_DRIVER")
	if dbDriver == "" {
		dbDriver = "sqlite"
	}

	dbPath := os.Getenv("BIFROST_DB_PATH")
	if dbPath == "" {
		dbPath = "./bifrost.db"
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
		DBDriver:          dbDriver,
		DBPath:            dbPath,
		Port:              port,
		CatchUpInterval:   catchUpInterval,
		AdminUIStaticPath: os.Getenv("BIFROST_ADMIN_UI_STATIC_PATH"),
		ViteDevServerURL:  os.Getenv("BIFROST_VITE_DEV_SERVER_URL"),
	}, nil
}
