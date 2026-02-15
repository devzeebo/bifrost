package cli

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

type RootCmd struct {
	Command    *cobra.Command
	Cfg        *Config
	Client     *Client
	HomeDirFn  func() (string, error)
	WorkDirFn  func() (string, error)
}

func NewRootCmd() *RootCmd {
	root := &RootCmd{
		HomeDirFn: os.UserHomeDir,
		WorkDirFn: os.Getwd,
	}

	cmd := &cobra.Command{
		Use:   "bf",
		Short: "Bifrost CLI - event-sourced rune management",
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			if cmd.Name() == "init" || cmd.Name() == "login" || cmd.Name() == "logout" || cmd.Name() == "admin" {
				return nil
			}

			home, err := root.HomeDirFn()
			if err != nil {
				return fmt.Errorf("could not determine home directory: %w", err)
			}

			cwd, err := root.WorkDirFn()
			if err != nil {
				return fmt.Errorf("could not determine working directory: %w", err)
			}

			cfg, err := LoadConfig(cwd, home)
			if err != nil {
				return err
			}

			for _, w := range cfg.Warnings {
				fmt.Fprintln(os.Stderr, w)
			}

			root.Cfg = cfg
			root.Client = NewClient(cfg)
			return nil
		},
	}

	cmd.PersistentFlags().Bool("human", false, "formatted table/text output")
	cmd.PersistentFlags().Bool("json", false, "force JSON output (default)")

	root.Command = cmd

	cmd.AddCommand(NewDepCmd(root))
	cmd.AddCommand(NewInitCmd())
	cmd.AddCommand(NewLoginCmd())
	cmd.AddCommand(NewLogoutCmd())
	cmd.AddCommand(NewAdminCmd().Command)

	return root
}
