package cli

import (
	"context"
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
			ctx := context.Background()

			// Clear projections
			_, err := admin.Ctx.DB.ExecContext(ctx, `DELETE FROM projections`)
			if err != nil {
				return fmt.Errorf("clear projections: %w", err)
			}
			fmt.Println("Cleared projections table")

			// Clear checkpoints
			_, err = admin.Ctx.DB.ExecContext(ctx, `DELETE FROM checkpoints`)
			if err != nil {
				return fmt.Errorf("clear checkpoints: %w", err)
			}
			fmt.Println("Cleared checkpoints table")

			// Run catch-up to rebuild
			admin.Ctx.Engine.RunCatchUpOnce(ctx)
			fmt.Println("Rebuilt projections from event history")

			return nil
		},
	}

	admin.Command.AddCommand(cmd)
}
