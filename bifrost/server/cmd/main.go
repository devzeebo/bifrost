package main

import (
	"context"
	"log"

	"github.com/devzeebo/bifrost/server"
)

func main() {
	cfg, err := server.LoadConfig()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	if err := server.Run(context.Background(), cfg); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
