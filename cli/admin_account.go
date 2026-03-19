package cli

import (
	"encoding/json"
	"fmt"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

func addAdminAccountCommands(admin *AdminCmd) {
	admin.Command.AddCommand(newAdminCreateAccountCmd(admin))
	admin.Command.AddCommand(newAdminListAccountsCmd(admin))
	admin.Command.AddCommand(newAdminSuspendAccountCmd(admin))
	admin.Command.AddCommand(newAdminGrantCmd(admin))
	admin.Command.AddCommand(newAdminRevokeCmd(admin))
	admin.Command.AddCommand(newAdminAssignRoleCmd(admin))
	admin.Command.AddCommand(newAdminRevokeRoleCmd(admin))
}

func resolveUsernameViaAPI(client *Client, username string) (string, error) {
	resp, err := client.DoGet("/api/resolve-username?username=" + username)
	if err != nil {
		return "", err
	}
	var result map[string]string
	if err := json.Unmarshal(resp, &result); err != nil {
		return "", err
	}
	return result["account_id"], nil
}

func newAdminCreateAccountCmd(admin *AdminCmd) *cobra.Command {
	return &cobra.Command{
		Use:   "create-account <username>",
		Short: "Create a new account",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			jsonMode, _ := cmd.Flags().GetBool("json")

			req := map[string]string{"username": args[0]}
			resp, err := admin.Client.DoPost("/api/create-account", req)
			if err != nil {
				return err
			}

			if jsonMode {
				fmt.Fprintln(cmd.OutOrStdout(), string(resp))
				return nil
			}

			var result map[string]string
			if err := json.Unmarshal(resp, &result); err != nil {
				return err
			}
			fmt.Fprintf(cmd.OutOrStdout(), "Account ID: %s\n", result["account_id"])
			fmt.Fprintf(cmd.OutOrStdout(), "Token: %s\n", result["pat"])
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

			resp, err := admin.Client.DoGet("/api/accounts")
			if err != nil {
				return err
			}

			if jsonMode {
				fmt.Fprintln(cmd.OutOrStdout(), string(resp))
				return nil
			}

			var entries []struct {
				AccountID string `json:"account_id"`
				Username  string `json:"username"`
				Status    string `json:"status"`
				Realms    []string `json:"realms"`
				PATCount  int    `json:"pat_count"`
			}
			if err := json.Unmarshal(resp, &entries); err != nil {
				return err
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

			accountID, err := resolveUsernameViaAPI(admin.Client, args[0])
			if err != nil {
				return err
			}

			req := map[string]interface{}{"id": accountID, "suspend": true}
			_, err = admin.Client.DoPost("/api/suspend-account", req)
			if err != nil {
				return err
			}

			if jsonMode {
				out, _ := json.Marshal(map[string]string{"status": "suspended"})
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

			accountID, err := resolveUsernameViaAPI(admin.Client, args[0])
			if err != nil {
				return err
			}

			req := map[string]string{
				"account_id": accountID,
				"realm_id":   args[1],
				"role":       "member",
			}
			_, err = admin.Client.DoPost("/api/grant-realm", req)
			if err != nil {
				return err
			}

			if jsonMode {
				out, _ := json.Marshal(map[string]string{"status": "granted"})
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

			accountID, err := resolveUsernameViaAPI(admin.Client, args[0])
			if err != nil {
				return err
			}

			req := map[string]string{
				"account_id": accountID,
				"realm_id":   args[1],
			}
			_, err = admin.Client.DoPost("/api/revoke-realm", req)
			if err != nil {
				return err
			}

			if jsonMode {
				out, _ := json.Marshal(map[string]string{"status": "revoked"})
				fmt.Fprintln(cmd.OutOrStdout(), string(out))
				return nil
			}

			fmt.Fprintf(cmd.OutOrStdout(), "Revoked %s access to realm %s\n", args[0], args[1])
			return nil
		},
	}
}

func newAdminAssignRoleCmd(admin *AdminCmd) *cobra.Command {
	return &cobra.Command{
		Use:   "assign-role <username> <realm-id> <role>",
		Short: "Assign a role to an account for a realm",
		Args:  cobra.ExactArgs(3),
		RunE: func(cmd *cobra.Command, args []string) error {
			jsonMode, _ := cmd.Flags().GetBool("json")

			accountID, err := resolveUsernameViaAPI(admin.Client, args[0])
			if err != nil {
				return err
			}

			req := map[string]string{
				"account_id": accountID,
				"realm_id":   args[1],
				"role":       args[2],
			}
			_, err = admin.Client.DoPost("/api/grant-realm", req)
			if err != nil {
				return err
			}

			if jsonMode {
				out, _ := json.Marshal(map[string]string{"status": "assigned", "role": args[2]})
				fmt.Fprintln(cmd.OutOrStdout(), string(out))
				return nil
			}

			fmt.Fprintf(cmd.OutOrStdout(), "Assigned role %s to %s for realm %s\n", args[2], args[0], args[1])
			return nil
		},
	}
}

func newAdminRevokeRoleCmd(admin *AdminCmd) *cobra.Command {
	return &cobra.Command{
		Use:   "revoke-role <username> <realm-id>",
		Short: "Revoke a role from an account for a realm",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			jsonMode, _ := cmd.Flags().GetBool("json")

			accountID, err := resolveUsernameViaAPI(admin.Client, args[0])
			if err != nil {
				return err
			}

			req := map[string]string{
				"account_id": accountID,
				"realm_id":   args[1],
			}
			_, err = admin.Client.DoPost("/api/revoke-realm", req)
			if err != nil {
				return err
			}

			if jsonMode {
				out, _ := json.Marshal(map[string]string{"status": "revoked"})
				fmt.Fprintln(cmd.OutOrStdout(), string(out))
				return nil
			}

			fmt.Fprintf(cmd.OutOrStdout(), "Revoked role from %s for realm %s\n", args[0], args[1])
			return nil
		},
	}
}
