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
			return rebuildProjections(ctx, admin.Ctx)
		},
	}

	admin.Command.AddCommand(cmd)
}

func rebuildProjections(ctx context.Context, adminCtx *AdminContext) error {
	// Clear all registered projection tables
	for _, table := range adminCtx.Engine.RegisteredTables() {
		_, err := adminCtx.DB.ExecContext(ctx, fmt.Sprintf("DELETE FROM %s", table))
		if err != nil {
			return fmt.Errorf("clear table %s: %w", table, err)
		}
		fmt.Printf("Cleared table: %s\n", table)
	}

	// Clear checkpoints
	_, err := adminCtx.DB.ExecContext(ctx, `DELETE FROM checkpoints`)
	if err != nil {
		return fmt.Errorf("clear checkpoints: %w", err)
	}
	fmt.Println("Cleared checkpoints table")

	// Run catch-up to rebuild
	adminCtx.Engine.RunCatchUpOnce(ctx)
	fmt.Println("Rebuilt projections from event history")

	return nil
}
