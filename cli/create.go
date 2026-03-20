package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/spf13/cobra"
)

type CreateCmd struct {
	Command *cobra.Command
}

func NewCreateCmd(clientFn func() *Client, out *bytes.Buffer) *CreateCmd {
	c := &CreateCmd{}

	cmd := &cobra.Command{
		Use:   "create [title]",
		Short: "Create a new rune",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			title := args[0]
			priorityStr, _ := cmd.Flags().GetString("priority")
			description, _ := cmd.Flags().GetString("description")
			parentID, _ := cmd.Flags().GetString("parent")
			humanMode, _ := cmd.Flags().GetBool("human")
			branch, _ := cmd.Flags().GetString("branch")
			noBranch, _ := cmd.Flags().GetBool("no-branch")
			branchSet := cmd.Flags().Changed("branch")
			noBranchSet := cmd.Flags().Changed("no-branch")

			if branchSet && noBranchSet {
				return fmt.Errorf("--branch and --no-branch are mutually exclusive")
			}
			if parentID == "" && !branchSet && !noBranchSet {
				return fmt.Errorf("--branch or --no-branch is required when no --parent is set")
			}

			priority, err := strconv.Atoi(priorityStr)
			if err != nil {
				return fmt.Errorf("invalid priority: %s", priorityStr)
			}

			body := map[string]any{
				"title":    title,
				"priority": priority,
			}
			if description != "" {
				body["description"] = description
			}
			if parentID != "" {
				body["parent_id"] = parentID
			}
			if noBranch {
				body["branch"] = ""
			} else if branchSet {
				body["branch"] = branch
			}

			respBody, err := clientFn().DoPost("/create-rune", body)
			if err != nil {
				return err
			}

			return PrintOutput(out, respBody, humanMode, func(w *bytes.Buffer, data []byte) {
				var result map[string]any
				if json.Unmarshal(data, &result) == nil {
					id, _ := result["id"].(string)
					t, _ := result["title"].(string)
					fmt.Fprintf(w, "Created rune %s: %s", id, t)
				}
			})
		},
	}

	cmd.Flags().StringP("priority", "p", "0", "rune priority (0-4)")
	cmd.Flags().StringP("description", "d", "", "rune description")
	cmd.Flags().String("parent", "", "parent rune ID")
	cmd.Flags().Bool("human", false, "human-readable output")
	cmd.Flags().StringP("branch", "b", "", "branch name for the rune")
	cmd.Flags().Bool("no-branch", false, "create rune without a branch")

	c.Command = cmd
	return c
}
