package cli

import (
	"encoding/json"
	"fmt"
	"text/tabwriter"

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

			req := map[string]string{"name": args[0]}
			resp, err := admin.Client.DoPost("/api/create-realm", req)
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
			fmt.Fprintf(cmd.OutOrStdout(), "Realm ID: %s\n", result["realm_id"])
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

			resp, err := admin.Client.DoGet("/api/realms")
			if err != nil {
				return err
			}

			if jsonMode {
				fmt.Fprintln(cmd.OutOrStdout(), string(resp))
				return nil
			}

			var entries []struct {
				RealmID string `json:"realm_id"`
				Name    string `json:"name"`
				Status  string `json:"status"`
			}
			if err := json.Unmarshal(resp, &entries); err != nil {
				return err
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

			req := map[string]string{"realm_id": args[0]}
			_, err := admin.Client.DoPost("/api/suspend-realm", req)
			if err != nil {
				return err
			}

			if jsonMode {
				out, _ := json.Marshal(map[string]string{"status": "suspended"})
				fmt.Fprintln(cmd.OutOrStdout(), string(out))
				return nil
			}

			fmt.Fprintf(cmd.OutOrStdout(), "Realm %s suspended\n", args[0])
			return nil
		},
	}
}
