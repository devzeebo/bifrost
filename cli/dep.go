package cli

import (
	"encoding/json"
	"fmt"
	"io"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

func NewDepCmd(root *RootCmd) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "dep",
		Short: "Manage rune dependencies",
	}

	cmd.AddCommand(newDepAddCmd(root))
	cmd.AddCommand(newDepRemoveCmd(root))
	cmd.AddCommand(newDepListCmd(root))

	return cmd
}

func newDepAddCmd(root *RootCmd) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "add <runeId> <targetId>",
		Short: "Add a dependency between runes",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			relType, _ := cmd.Flags().GetString("type")

			body, err := json.Marshal(map[string]string{
				"runeId":       args[0],
				"targetId":     args[1],
				"relationship": relType,
			})
			if err != nil {
				return fmt.Errorf("marshaling request: %w", err)
			}

			resp, err := root.Client.DoPost("/add-dependency", body)
			if err != nil {
				return fmt.Errorf("adding dependency: %w", err)
			}
			defer resp.Body.Close()

			respBody, err := io.ReadAll(resp.Body)
			if err != nil {
				return fmt.Errorf("reading response: %w", err)
			}

			cmd.Print(string(respBody))
			return nil
		},
	}

	cmd.Flags().String("type", "blocks", "relationship type (blocks|relates_to|duplicates|supersedes|replies_to)")

	return cmd
}

func newDepRemoveCmd(root *RootCmd) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "remove <runeId> <targetId>",
		Short: "Remove a dependency between runes",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			relType, _ := cmd.Flags().GetString("type")

			body, err := json.Marshal(map[string]string{
				"runeId":       args[0],
				"targetId":     args[1],
				"relationship": relType,
			})
			if err != nil {
				return fmt.Errorf("marshaling request: %w", err)
			}

			resp, err := root.Client.DoPost("/remove-dependency", body)
			if err != nil {
				return fmt.Errorf("removing dependency: %w", err)
			}
			defer resp.Body.Close()

			respBody, err := io.ReadAll(resp.Body)
			if err != nil {
				return fmt.Errorf("reading response: %w", err)
			}

			cmd.Print(string(respBody))
			return nil
		},
	}

	cmd.Flags().String("type", "blocks", "relationship type (blocks|relates_to|duplicates|supersedes|replies_to)")

	return cmd
}

func newDepListCmd(root *RootCmd) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list <runeId>",
		Short: "List dependencies for a rune",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			relType, _ := cmd.Flags().GetString("type")
			humanMode, _ := cmd.Flags().GetBool("human")

			params := map[string]string{
				"runeId":       args[0],
				"relationship": relType,
			}

			resp, err := root.Client.DoGet("/dependencies", params)
			if err != nil {
				return fmt.Errorf("listing dependencies: %w", err)
			}
			defer resp.Body.Close()

			respBody, err := io.ReadAll(resp.Body)
			if err != nil {
				return fmt.Errorf("reading response: %w", err)
			}

			if humanMode {
				var deps []map[string]string
				if err := json.Unmarshal(respBody, &deps); err != nil {
					return fmt.Errorf("parsing response: %w", err)
				}

				w := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 0, 2, ' ', 0)
				fmt.Fprintln(w, "Target\tRelationship")
				fmt.Fprintln(w, "------\t------------")
				for _, dep := range deps {
					fmt.Fprintf(w, "%s\t%s\n", dep["targetId"], dep["relationship"])
				}
				w.Flush()
				return nil
			}

			cmd.Print(string(respBody))
			return nil
		},
	}

	cmd.Flags().String("type", "blocks", "relationship type (blocks|relates_to|duplicates|supersedes|replies_to)")

	return cmd
}
