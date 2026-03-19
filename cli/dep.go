package cli

import (
	"encoding/json"
	"fmt"
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

var validRelationships = map[string]bool{
	"blocks":        true,
	"relates_to":    true,
	"duplicates":    true,
	"supersedes":    true,
	"replies_to":    true,
	"blocked_by":    true,
	"duplicated_by": true,
	"superseded_by": true,
	"replied_to_by": true,
}

var inverseToForward = map[string]string{
	"blocked_by":    "blocks",
	"duplicated_by": "duplicates",
	"superseded_by": "supersedes",
	"replied_to_by": "replies_to",
}

func normalizeRelationship(relType, sourceID, targetID string) (string, string, string) {
	if forward, ok := inverseToForward[relType]; ok {
		return forward, targetID, sourceID
	}
	return relType, sourceID, targetID
}

func newDepAddCmd(root *RootCmd) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "add <rune1> <relationship> <rune2>",
		Short: "Add a dependency between runes",
		Args:  cobra.ExactArgs(3),
		RunE: func(cmd *cobra.Command, args []string) error {
			relType := args[1]
			if !validRelationships[relType] {
				return fmt.Errorf("invalid relationship %q: must be one of blocks, relates_to, duplicates, supersedes, replies_to, blocked_by, duplicated_by, superseded_by, replied_to_by", relType)
			}

			relType, sourceID, targetID := normalizeRelationship(relType, args[0], args[2])

			body := map[string]string{
				"rune_id":      sourceID,
				"target_id":    targetID,
				"relationship": relType,
			}

			respBody, err := root.Client.DoPost("/add-dependency", body)
			if err != nil {
				return fmt.Errorf("adding dependency: %w", err)
			}

			cmd.Print(string(respBody))
			return nil
		},
	}

	return cmd
}

func newDepRemoveCmd(root *RootCmd) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "remove <rune1> <relationship> <rune2>",
		Short: "Remove a dependency between runes",
		Args:  cobra.ExactArgs(3),
		RunE: func(cmd *cobra.Command, args []string) error {
			relType := args[1]
			if !validRelationships[relType] {
				return fmt.Errorf("invalid relationship %q: must be one of blocks, relates_to, duplicates, supersedes, replies_to, blocked_by, duplicated_by, superseded_by, replied_to_by", relType)
			}

			relType, sourceID, targetID := normalizeRelationship(relType, args[0], args[2])

			body := map[string]string{
				"rune_id":      sourceID,
				"target_id":    targetID,
				"relationship": relType,
			}

			respBody, err := root.Client.DoPost("/remove-dependency", body)
			if err != nil {
				return fmt.Errorf("removing dependency: %w", err)
			}

			cmd.Print(string(respBody))
			return nil
		},
	}

	return cmd
}

func newDepListCmd(root *RootCmd) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list <runeId>",
		Short: "List dependencies for a rune",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			humanMode, _ := cmd.Flags().GetBool("human")

			params := map[string]string{
				"id": args[0],
			}

			respBody, err := root.Client.DoGetWithParams("/rune", params)
			if err != nil {
				return fmt.Errorf("listing dependencies: %w", err)
			}

			var runeDetail map[string]interface{}
			if err := json.Unmarshal(respBody, &runeDetail); err != nil {
				return fmt.Errorf("parsing response: %w", err)
			}

			deps, _ := runeDetail["dependencies"].([]interface{})

			if humanMode {
				w := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 0, 2, ' ', 0)
				fmt.Fprintln(w, "Target\tRelationship")
				fmt.Fprintln(w, "------\t------------")
				for _, d := range deps {
					dep, _ := d.(map[string]interface{})
					targetID, _ := dep["target_id"].(string)
					rel, _ := dep["relationship"].(string)
					fmt.Fprintf(w, "%s\t%s\n", targetID, rel)
				}
				w.Flush()
				return nil
			}

			depsJSON, err := json.Marshal(deps)
			if err != nil {
				return fmt.Errorf("marshaling dependencies: %w", err)
			}
			cmd.Print(string(depsJSON))
			return nil
		},
	}

	return cmd
}
