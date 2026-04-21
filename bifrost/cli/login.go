package cli

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func resolveDefaultURL(workDir string) string {
	v := viper.New()
	v.SetConfigName(".bifrost")
	v.SetConfigType("yaml")
	v.AddConfigPath(workDir)
	if err := v.ReadInConfig(); err == nil {
		if url := v.GetString("url"); url != "" {
			return url
		}
	}
	return "http://localhost:8080"
}

func NewLoginCmd() *cobra.Command {
	var homeDir string
	var workDir string

	cmd := &cobra.Command{
		Use:   "login",
		Short: "Store credentials for a Bifrost server",
		RunE: func(cmd *cobra.Command, args []string) error {
			token, _ := cmd.Flags().GetString("token")
			if token == "" {
				return fmt.Errorf("required flag \"token\" not set")
			}

			if homeDir == "" {
				var err error
				homeDir, err = os.UserHomeDir()
				if err != nil {
					return fmt.Errorf("could not determine home directory: %w", err)
				}
			}

			if workDir == "" {
				var err error
				workDir, err = os.Getwd()
				if err != nil {
					return fmt.Errorf("could not determine working directory: %w", err)
				}
			}

			url, _ := cmd.Flags().GetString("url")
			if url == "" {
				url = resolveDefaultURL(workDir)
			}

			if err := SaveCredential(homeDir, url, token); err != nil {
				return err
			}

			fmt.Fprintln(cmd.OutOrStdout(), "Logged in to", url)
			return nil
		},
	}

	cmd.Flags().String("url", "", "Bifrost server URL")
	cmd.Flags().String("token", "", "Personal access token")
	cmd.Flags().StringVar(&homeDir, "home-dir", "", "Home directory (defaults to user home)")
	cmd.Flags().StringVar(&workDir, "work-dir", "", "Working directory (defaults to cwd)")

	// Hide test-only flags
	cmd.Flags().MarkHidden("home-dir")
	cmd.Flags().MarkHidden("work-dir")

	return cmd
}
