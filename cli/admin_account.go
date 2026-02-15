package cli

import (
	"encoding/json"
	"fmt"
	"text/tabwriter"

	"github.com/devzeebo/bifrost/domain"
	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/spf13/cobra"
)

func addAdminAccountCommands(admin *AdminCmd) {
	admin.Command.AddCommand(newAdminCreateAccountCmd(admin))
	admin.Command.AddCommand(newAdminListAccountsCmd(admin))
	admin.Command.AddCommand(newAdminSuspendAccountCmd(admin))
	admin.Command.AddCommand(newAdminGrantCmd(admin))
	admin.Command.AddCommand(newAdminRevokeCmd(admin))
}

func newAdminCreateAccountCmd(admin *AdminCmd) *cobra.Command {
	return &cobra.Command{
		Use:   "create-account <username>",
		Short: "Create a new account",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			jsonMode, _ := cmd.Flags().GetBool("json")
			ctx := cmd.Context()

			result, err := domain.HandleCreateAccount(ctx, domain.CreateAccount{
				Username: args[0],
			}, admin.Ctx.EventStore, admin.Ctx.ProjectionStore)
			if err != nil {
				return err
			}

			events, err := admin.Ctx.EventStore.ReadStream(ctx, "_admin", "account-"+result.AccountID, 0)
			if err != nil {
				return err
			}
			if err := syncProjections(ctx, admin.Ctx, events); err != nil {
				return err
			}

			if jsonMode {
				out, _ := json.Marshal(map[string]string{
					"account_id": result.AccountID,
					"token":      result.RawToken,
				})
				fmt.Fprintln(cmd.OutOrStdout(), string(out))
				return nil
			}

			fmt.Fprintf(cmd.OutOrStdout(), "Account ID: %s\n", result.AccountID)
			fmt.Fprintf(cmd.OutOrStdout(), "Token: %s\n", result.RawToken)
			fmt.Fprintln(cmd.OutOrStdout(), "Save this token — it will not be shown again")
			return nil
		},
	}
}

func newAdminListAccountsCmd(admin *AdminCmd) *cobra.Command {
	return &cobra.Command{
		Use:   "list-accounts",
		Short: "List all accounts",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			jsonMode, _ := cmd.Flags().GetBool("json")
			ctx := cmd.Context()

			rows, err := admin.Ctx.ProjectionStore.List(ctx, "_admin", "account_list")
			if err != nil {
				return err
			}

			var entries []projectors.AccountListEntry
			for _, raw := range rows {
				var entry projectors.AccountListEntry
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
			fmt.Fprintln(w, "ID\tUsername\tStatus\tRealms\tPATs")
			fmt.Fprintln(w, "--\t--------\t------\t------\t----")
			for _, e := range entries {
				realms := fmt.Sprintf("%d", len(e.Realms))
				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%d\n", e.AccountID, e.Username, e.Status, realms, e.PATCount)
			}
			w.Flush()
			return nil
		},
	}
}

func newAdminSuspendAccountCmd(admin *AdminCmd) *cobra.Command {
	return &cobra.Command{
		Use:   "suspend-account <username>",
		Short: "Suspend an account",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			jsonMode, _ := cmd.Flags().GetBool("json")
			ctx := cmd.Context()

			accountID, err := resolveUsername(ctx, admin.Ctx.ProjectionStore, args[0])
			if err != nil {
				return err
			}

			err = domain.HandleSuspendAccount(ctx, domain.SuspendAccount{
				AccountID: accountID,
				Reason:    "suspended via admin CLI",
			}, admin.Ctx.EventStore)
			if err != nil {
				return err
			}

			events, err := admin.Ctx.EventStore.ReadStream(ctx, "_admin", "account-"+accountID, 0)
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

			fmt.Fprintf(cmd.OutOrStdout(), "Account %s suspended\n", args[0])
			return nil
		},
	}
}

func newAdminGrantCmd(admin *AdminCmd) *cobra.Command {
	return &cobra.Command{
		Use:   "grant <username> <realm-id>",
		Short: "Grant realm access to an account",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			jsonMode, _ := cmd.Flags().GetBool("json")
			ctx := cmd.Context()

			accountID, err := resolveUsername(ctx, admin.Ctx.ProjectionStore, args[0])
			if err != nil {
				return err
			}

			err = domain.HandleGrantRealm(ctx, domain.GrantRealm{
				AccountID: accountID,
				RealmID:   args[1],
			}, admin.Ctx.EventStore)
			if err != nil {
				return err
			}

			events, err := admin.Ctx.EventStore.ReadStream(ctx, "_admin", "account-"+accountID, 0)
			if err != nil {
				return err
			}
			if err := syncProjections(ctx, admin.Ctx, events); err != nil {
				return err
			}

			if jsonMode {
				out, _ := json.Marshal(map[string]string{
					"status": "granted",
				})
				fmt.Fprintln(cmd.OutOrStdout(), string(out))
				return nil
			}

			fmt.Fprintf(cmd.OutOrStdout(), "Granted %s access to realm %s\n", args[0], args[1])
			return nil
		},
	}
}

func newAdminRevokeCmd(admin *AdminCmd) *cobra.Command {
	return &cobra.Command{
		Use:   "revoke <username> <realm-id>",
		Short: "Revoke realm access from an account",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			jsonMode, _ := cmd.Flags().GetBool("json")
			ctx := cmd.Context()

			accountID, err := resolveUsername(ctx, admin.Ctx.ProjectionStore, args[0])
			if err != nil {
				return err
			}

			err = domain.HandleRevokeRealm(ctx, domain.RevokeRealm{
				AccountID: accountID,
				RealmID:   args[1],
			}, admin.Ctx.EventStore)
			if err != nil {
				return err
			}

			events, err := admin.Ctx.EventStore.ReadStream(ctx, "_admin", "account-"+accountID, 0)
			if err != nil {
				return err
			}
			if err := syncProjections(ctx, admin.Ctx, events); err != nil {
				return err
			}

			if jsonMode {
				out, _ := json.Marshal(map[string]string{
					"status": "revoked",
				})
				fmt.Fprintln(cmd.OutOrStdout(), string(out))
				return nil
			}

			fmt.Fprintf(cmd.OutOrStdout(), "Revoked %s access to realm %s\n", args[0], args[1])
			return nil
		},
	}
}
