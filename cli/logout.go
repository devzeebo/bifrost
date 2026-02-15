package cli

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

func NewLogoutCmd() *cobra.Command {
	var homeDir string
	var workDir string

	cmd := &cobra.Command{
		Use:   "logout",
		Short: "Remove stored credentials for a Bifrost server",
		RunE: func(cmd *cobra.Command, args []string) error {
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

			if err := DeleteCredential(homeDir, url); err != nil {
				return err
			}

			fmt.Fprintln(cmd.OutOrStdout(), "Logged out from", url)
			return nil
		},
	}

	cmd.Flags().String("url", "", "Bifrost server URL")
	cmd.Flags().StringVar(&homeDir, "home-dir", "", "Home directory (defaults to user home)")
	cmd.Flags().StringVar(&workDir, "work-dir", "", "Working directory (defaults to cwd)")

	// Hide test-only flags
	cmd.Flags().MarkHidden("home-dir")
	cmd.Flags().MarkHidden("work-dir")

	return cmd
}
