package cli

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

type AdminCmd struct {
	Command *cobra.Command
	Client  *Client
}

func NewAdminCmd() *AdminCmd {
	admin := &AdminCmd{}

	cmd := &cobra.Command{
		Use:   "admin",
		Short: "Server administration commands via HTTP API",
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			// Skip client setup for bootstrap command (no auth needed)
			if cmd.Name() == "bootstrap" {
				return nil
			}

			// Load config and credentials
			workDir, _ := cmd.Flags().GetString("work-dir")
			if workDir == "" {
				var err error
				workDir, err = os.Getwd()
				if err != nil {
					return fmt.Errorf("could not determine working directory: %w", err)
				}
			}

			homeDir, _ := cmd.Flags().GetString("home-dir")
			if homeDir == "" {
				var err error
				homeDir, err = os.UserHomeDir()
				if err != nil {
					return fmt.Errorf("could not determine home directory: %w", err)
				}
			}

			cfg, err := LoadConfig(workDir, homeDir)
			if err != nil {
				return fmt.Errorf("load config: %w", err)
			}

			if cfg.URL == "" {
				return fmt.Errorf("no server URL configured (set in .bifrost.yaml or use --url flag)")
			}

			if cfg.APIKey == "" {
				return fmt.Errorf("no API key configured (run 'bf login' or set BIFROST_API_KEY)")
			}

			// Admin commands always use the _admin realm
			admin.Client = NewClient(cfg.URL, cfg.APIKey, "_admin")
			return nil
		},
	}

	cmd.PersistentFlags().String("url", "", "Bifrost server URL (overrides .bifrost.yaml)")
	cmd.PersistentFlags().String("work-dir", "", "Working directory (defaults to cwd)")
	cmd.PersistentFlags().String("home-dir", "", "Home directory (defaults to user home)")

	// Hide test-only flags
	cmd.Flags().MarkHidden("work-dir")
	cmd.Flags().MarkHidden("home-dir")

	admin.Command = cmd

	addAdminRealmCommands(admin)
	addAdminAccountCommands(admin)
	addAdminPATCommands(admin)
	addAdminRebuildCommands(admin)
	addAdminBootstrapCommands(admin)

	return admin
}
