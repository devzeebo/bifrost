package cli

import (
	"fmt"

	"github.com/spf13/cobra"
)

func addAdminRebuildCommands(admin *AdminCmd) {
	cmd := &cobra.Command{
		Use:   "rebuild-projections",
		Short: "Rebuild all projections from event history",
		Long: `Rebuild all projections from scratch by clearing existing projections
and checkpoints, then replaying all events.

This is useful when projector logic has been fixed and you need to
reconstruct the projection state from the event store.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			_, err := admin.Client.DoPost("/api/rebuild-projections", nil)
			if err != nil {
				return err
			}
			fmt.Fprintln(cmd.OutOrStdout(), "Projections rebuilt successfully")
			return nil
		},
	}

	admin.Command.AddCommand(cmd)
}
