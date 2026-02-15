package cli

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"

	_ "modernc.org/sqlite"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/devzeebo/bifrost/providers/sqlite"
	"github.com/spf13/cobra"
)

type AdminContext struct {
	EventStore      core.EventStore
	ProjectionStore core.ProjectionStore
	Engine          core.ProjectionEngine
	DB              *sql.DB
}

type AdminCmd struct {
	Command *cobra.Command
	Ctx     *AdminContext
}

func NewAdminCmd() *AdminCmd {
	admin := &AdminCmd{
		Ctx: &AdminContext{},
	}

	cmd := &cobra.Command{
		Use:   "admin",
		Short: "Direct database administration commands",
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			dbPath, _ := cmd.Flags().GetString("db")
			if dbPath == "" {
				dbPath = os.Getenv("BIFROST_DB_PATH")
			}
			if dbPath == "" {
				dbPath = "bifrost.db"
			}

			db, err := sql.Open("sqlite", dbPath)
			if err != nil {
				return fmt.Errorf("open database: %w", err)
			}
			admin.Ctx.DB = db

			eventStore, err := sqlite.NewEventStore(db)
			if err != nil {
				return fmt.Errorf("create event store: %w", err)
			}

			projectionStore, err := sqlite.NewProjectionStore(db)
			if err != nil {
				return fmt.Errorf("create projection store: %w", err)
			}

			checkpointStore, err := sqlite.NewCheckpointStore(db)
			if err != nil {
				return fmt.Errorf("create checkpoint store: %w", err)
			}

			engine := core.NewProjectionEngine(eventStore, projectionStore, checkpointStore)
			engine.Register(projectors.NewRealmListProjector())
			engine.Register(projectors.NewRuneListProjector())
			engine.Register(projectors.NewRuneDetailProjector())
			engine.Register(projectors.NewDependencyGraphProjector())
			engine.Register(projectors.NewAccountLookupProjector())
			engine.Register(projectors.NewAccountListProjector())

			admin.Ctx.EventStore = eventStore
			admin.Ctx.ProjectionStore = projectionStore
			admin.Ctx.Engine = engine

			return nil
		},
		PersistentPostRunE: func(cmd *cobra.Command, args []string) error {
			if admin.Ctx.DB != nil {
				return admin.Ctx.DB.Close()
			}
			return nil
		},
	}

	cmd.PersistentFlags().String("db", "", "path to SQLite database (default: bifrost.db, env: BIFROST_DB_PATH)")

	admin.Command = cmd

	addAdminRealmCommands(admin)
	addAdminAccountCommands(admin)
	addAdminPATCommands(admin)

	return admin
}

func resolveUsername(ctx context.Context, projectionStore core.ProjectionStore, username string) (string, error) {
	var accountID string
	err := projectionStore.Get(ctx, "_admin", "account_lookup", "username:"+username, &accountID)
	if err != nil {
		var nfe *core.NotFoundError
		if errors.As(err, &nfe) {
			return "", fmt.Errorf("username %q not found", username)
		}
		return "", err
	}
	return accountID, nil
}

func syncProjections(ctx context.Context, admin *AdminContext, events []core.Event) error {
	return admin.Engine.RunSync(ctx, events)
}
