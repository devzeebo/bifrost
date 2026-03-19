package cli

import (
	"encoding/json"
	"fmt"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

func NewRealmCmd(root *RootCmd) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "realm",
		Short: "Manage realms",
	}

	cmd.AddCommand(newRealmCreateCmd(root))
	cmd.AddCommand(newRealmListCmd(root))

	return cmd
}

func newRealmCreateCmd(root *RootCmd) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "create <name>",
		Short: "Create a new realm",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			humanMode, _ := cmd.Flags().GetBool("human")

			body := map[string]string{
				"name": args[0],
			}

			respBody, err := root.Client.DoPost("/create-realm", body)
			if err != nil {
				return fmt.Errorf("creating realm: %w", err)
			}

			if humanMode {
				var result map[string]string
				if err := json.Unmarshal(respBody, &result); err != nil {
					return fmt.Errorf("parsing response: %w", err)
				}
				fmt.Fprintf(cmd.OutOrStdout(), "Created realm %s\n", result["realm_id"])
				return nil
			}

			cmd.Print(string(respBody))
			return nil
		},
	}

	return cmd
}

func newRealmListCmd(root *RootCmd) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List all realms",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			humanMode, _ := cmd.Flags().GetBool("human")

			respBody, err := root.Client.DoGet("/realms")
			if err != nil {
				return fmt.Errorf("listing realms: %w", err)
			}

			if humanMode {
				var realms []map[string]string
				if err := json.Unmarshal(respBody, &realms); err != nil {
					return fmt.Errorf("parsing response: %w", err)
				}

				w := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 0, 2, ' ', 0)
				fmt.Fprintln(w, "ID\tName\tStatus")
				fmt.Fprintln(w, "--\t----\t------")
				for _, r := range realms {
					fmt.Fprintf(w, "%s\t%s\t%s\n", r["id"], r["name"], r["status"])
				}
				w.Flush()
				return nil
			}

			cmd.Print(string(respBody))
			return nil
		},
	}

	return cmd
}

