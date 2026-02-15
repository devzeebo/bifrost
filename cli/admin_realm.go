package cli

import (
	"encoding/json"
	"fmt"
	"text/tabwriter"

	"github.com/devzeebo/bifrost/domain"
	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/spf13/cobra"
)

func addAdminRealmCommands(admin *AdminCmd) {
	admin.Command.AddCommand(newAdminCreateRealmCmd(admin))
	admin.Command.AddCommand(newAdminListRealmsCmd(admin))
	admin.Command.AddCommand(newAdminSuspendRealmCmd(admin))
}

func newAdminCreateRealmCmd(admin *AdminCmd) *cobra.Command {
	return &cobra.Command{
		Use:   "create-realm <name>",
		Short: "Create a new realm",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			jsonMode, _ := cmd.Flags().GetBool("json")
			ctx := cmd.Context()

			result, err := domain.HandleCreateRealm(ctx, domain.CreateRealm{
				Name: args[0],
			}, admin.Ctx.EventStore)
			if err != nil {
				return err
			}

			events, err := admin.Ctx.EventStore.ReadStream(ctx, "_admin", "realm-"+result.RealmID, 0)
			if err != nil {
				return err
			}
			if err := syncProjections(ctx, admin.Ctx, events); err != nil {
				return err
			}

			if jsonMode {
				out, _ := json.Marshal(map[string]string{
					"realm_id": result.RealmID,
				})
				fmt.Fprintln(cmd.OutOrStdout(), string(out))
				return nil
			}

			fmt.Fprintf(cmd.OutOrStdout(), "Realm ID: %s\n", result.RealmID)
			return nil
		},
	}
}

func newAdminListRealmsCmd(admin *AdminCmd) *cobra.Command {
	return &cobra.Command{
		Use:   "list-realms",
		Short: "List all realms",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			jsonMode, _ := cmd.Flags().GetBool("json")
			ctx := cmd.Context()

			rows, err := admin.Ctx.ProjectionStore.List(ctx, "_admin", "realm_list")
			if err != nil {
				return err
			}

			var entries []projectors.RealmListEntry
			for _, raw := range rows {
				var entry projectors.RealmListEntry
				if err := json.Unmarshal(raw, &entry); err != nil {
					return err
				}
				entries = append(entries, entry)
			}

			if jsonMode {
				out, _ := json.Marshal(entries)
				fmt.Fprintln(cmd.OutOrStdout(), string(out))
				return nil
			}

			w := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 0, 2, ' ', 0)
			fmt.Fprintln(w, "ID\tName\tStatus")
			fmt.Fprintln(w, "--\t----\t------")
			for _, e := range entries {
				fmt.Fprintf(w, "%s\t%s\t%s\n", e.RealmID, e.Name, e.Status)
			}
			w.Flush()
			return nil
		},
	}
}

func newAdminSuspendRealmCmd(admin *AdminCmd) *cobra.Command {
	return &cobra.Command{
		Use:   "suspend-realm <realm-id>",
		Short: "Suspend a realm",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			jsonMode, _ := cmd.Flags().GetBool("json")
			ctx := cmd.Context()

			err := domain.HandleSuspendRealm(ctx, domain.SuspendRealm{
				RealmID: args[0],
				Reason:  "suspended via admin CLI",
			}, admin.Ctx.EventStore)
			if err != nil {
				return err
			}

			events, err := admin.Ctx.EventStore.ReadStream(ctx, "_admin", "realm-"+args[0], 0)
			if err != nil {
				return err
			}
			if err := syncProjections(ctx, admin.Ctx, events); err != nil {
				return err
			}

			if jsonMode {
				out, _ := json.Marshal(map[string]string{
					"status": "suspended",
				})
				fmt.Fprintln(cmd.OutOrStdout(), string(out))
				return nil
			}

			fmt.Fprintf(cmd.OutOrStdout(), "Realm %s suspended\n", args[0])
			return nil
		},
	}
}
