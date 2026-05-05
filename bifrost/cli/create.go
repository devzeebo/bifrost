package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

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
			tags, _ := cmd.Flags().GetStringSlice("tag")
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
			if len(tags) > 0 {
				normalized := make([]string, 0, len(tags))
				for _, tag := range tags {
					tag = strings.ToLower(strings.TrimSpace(tag))
					if tag != "" {
						normalized = append(normalized, tag)
					}
				}
				if len(normalized) > 0 {
					body["tags"] = normalized
				}
			}

			respBody, err := clientFn().DoPost("/create-rune", body)
			if err != nil {
				return err
			}

			// Extract created rune ID for AC operations
			var createdRune map[string]any
			if json.Unmarshal(respBody, &createdRune) == nil {
				if runeID, ok := createdRune["id"].(string); ok {
					// Handle --ac-add flags
					if cmd.Flags().Changed("ac-add") {
						acAddJSONs, _ := cmd.Flags().GetStringArray("ac-add")
						for _, acJSON := range acAddJSONs {
							var acBody map[string]any
							if err := json.Unmarshal([]byte(acJSON), &acBody); err != nil {
								return fmt.Errorf("invalid JSON for --ac-add: %s", acJSON)
							}
							acBody["rune_id"] = runeID
							_, err := clientFn().DoPost("/add-ac", acBody)
							if err != nil {
								return err
							}
						}
					}
				}
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
	cmd.Flags().StringSlice("tag", nil, "tag to apply (repeatable)")
	cmd.Flags().StringArray("ac-add", nil, "add acceptance criteria as JSON (repeatable)")

	c.Command = cmd
	return c
}
