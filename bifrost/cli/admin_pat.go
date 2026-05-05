package cli

import (
	"encoding/json"
	"fmt"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

func addAdminPATCommands(admin *AdminCmd) {
	admin.Command.AddCommand(newAdminCreatePATCmd(admin))
	admin.Command.AddCommand(newAdminListPATsCmd(admin))
	admin.Command.AddCommand(newAdminRevokePATCmd(admin))
}

func newAdminCreatePATCmd(admin *AdminCmd) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "create-pat <username>",
		Short: "Create a personal access token for an account",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			jsonMode, _ := cmd.Flags().GetBool("json")
			label, _ := cmd.Flags().GetString("label")

			accountID, err := resolveUsernameViaAPI(admin.Client, args[0])
			if err != nil {
				return err
			}

			req := map[string]string{
				"account_id": accountID,
				"label":      label,
			}
			resp, err := admin.Client.DoPost("/api/create-pat", req)
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
			fmt.Fprintf(cmd.OutOrStdout(), "PAT ID: %s\n", result["pat_id"])
			fmt.Fprintf(cmd.OutOrStdout(), "Token: %s\n", result["pat"])
			fmt.Fprintln(cmd.OutOrStdout(), "Save this token — it will not be shown again")
			return nil
		},
	}

	cmd.Flags().String("label", "", "optional label for the PAT")

	return cmd
}

func newAdminListPATsCmd(admin *AdminCmd) *cobra.Command {
	return &cobra.Command{
		Use:   "list-pats <username>",
		Short: "List personal access tokens for an account",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			jsonMode, _ := cmd.Flags().GetBool("json")

			accountID, err := resolveUsernameViaAPI(admin.Client, args[0])
			if err != nil {
				return err
			}

			resp, err := admin.Client.DoGet("/api/pats?account_id=" + accountID)
			if err != nil {
				return err
			}

			if jsonMode {
				fmt.Fprintln(cmd.OutOrStdout(), string(resp))
				return nil
			}

			var pats []struct {
				ID        string `json:"id"`
				Label     string `json:"label"`
				CreatedAt string `json:"created_at"`
			}
			if err := json.Unmarshal(resp, &pats); err != nil {
				return err
			}

			w := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 0, 2, ' ', 0)
			fmt.Fprintln(w, "PAT ID\tLabel\tCreated")
			fmt.Fprintln(w, "------\t-----\t-------")
			for _, p := range pats {
				fmt.Fprintf(w, "%s\t%s\t%s\n", p.ID, p.Label, p.CreatedAt)
			}
			w.Flush()
			return nil
		},
	}
}

func newAdminRevokePATCmd(admin *AdminCmd) *cobra.Command {
	return &cobra.Command{
		Use:   "revoke-pat <username> <pat-id>",
		Short: "Revoke a personal access token",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			jsonMode, _ := cmd.Flags().GetBool("json")

			accountID, err := resolveUsernameViaAPI(admin.Client, args[0])
			if err != nil {
				return err
			}

			req := map[string]string{
				"account_id": accountID,
				"pat_id":     args[1],
			}
			_, err = admin.Client.DoPost("/api/revoke-pat", req)
			if err != nil {
				return err
			}

			if jsonMode {
				out, _ := json.Marshal(map[string]string{"status": "revoked"})
				fmt.Fprintln(cmd.OutOrStdout(), string(out))
				return nil
			}

			fmt.Fprintf(cmd.OutOrStdout(), "PAT %s revoked\n", args[1])
			return nil
		},
	}
}
