package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/spf13/cobra"
)

type UpdateCmd struct {
	Command *cobra.Command
}

func NewUpdateCmd(clientFn func() *Client, out *bytes.Buffer) *UpdateCmd {
	c := &UpdateCmd{}

	cmd := &cobra.Command{
		Use:   "update [id]",
		Short: "Update a rune",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]
			humanMode, _ := cmd.Flags().GetBool("human")

			body := map[string]any{"id": id}

			if cmd.Flags().Changed("title") {
				title, _ := cmd.Flags().GetString("title")
				body["title"] = title
			}
			if cmd.Flags().Changed("priority") {
				priorityStr, _ := cmd.Flags().GetString("priority")
				p, err := strconv.Atoi(priorityStr)
				if err != nil {
					return fmt.Errorf("invalid priority: %s", priorityStr)
				}
				body["priority"] = p
			}
			if cmd.Flags().Changed("description") {
				desc, _ := cmd.Flags().GetString("description")
				body["description"] = desc
			}
			if cmd.Flags().Changed("branch") {
				branch, _ := cmd.Flags().GetString("branch")
				body["branch"] = branch
			}
			if cmd.Flags().Changed("add-tag") {
				tags, _ := cmd.Flags().GetStringSlice("add-tag")
				normalized := make([]string, 0, len(tags))
				for _, tag := range tags {
					tag = strings.ToLower(strings.TrimSpace(tag))
					if tag != "" {
						normalized = append(normalized, tag)
					}
				}
				body["add_tags"] = normalized
			}
			if cmd.Flags().Changed("remove-tag") {
				tags, _ := cmd.Flags().GetStringSlice("remove-tag")
				normalized := make([]string, 0, len(tags))
				for _, tag := range tags {
					tag = strings.ToLower(strings.TrimSpace(tag))
					if tag != "" {
						normalized = append(normalized, tag)
					}
				}
				body["remove_tags"] = normalized
			}

			_, err := clientFn().DoPost("/update-rune", body)
			if err != nil {
				return err
			}

			// Handle --ac-add flags
			if cmd.Flags().Changed("ac-add") {
				acAddJSONs, _ := cmd.Flags().GetStringArray("ac-add")
				for _, acJSON := range acAddJSONs {
					var acBody map[string]any
					if err := json.Unmarshal([]byte(acJSON), &acBody); err != nil {
						return fmt.Errorf("invalid JSON for --ac-add: %s", acJSON)
					}
					acBody["rune_id"] = id
					_, err := clientFn().DoPost("/add-ac", acBody)
					if err != nil {
						return err
					}
				}
			}

			// Handle --ac-update flags
			if cmd.Flags().Changed("ac-update") {
				acUpdateJSONs, _ := cmd.Flags().GetStringArray("ac-update")
				for _, acJSON := range acUpdateJSONs {
					var acBody map[string]any
					if err := json.Unmarshal([]byte(acJSON), &acBody); err != nil {
						return fmt.Errorf("invalid JSON for --ac-update: %s", acJSON)
					}
					acBody["rune_id"] = id
					_, err := clientFn().DoPost("/update-ac", acBody)
					if err != nil {
						return err
					}
				}
			}

			// Handle --ac-remove flags
			if cmd.Flags().Changed("ac-remove") {
				acRemoveIDs, _ := cmd.Flags().GetStringArray("ac-remove")
				for _, acID := range acRemoveIDs {
					acBody := map[string]any{
						"rune_id": id,
						"id":      acID,
					}
					_, err := clientFn().DoPost("/remove-ac", acBody)
					if err != nil {
						return err
					}
				}
			}

			if humanMode {
				fmt.Fprintf(out, "Rune %s updated", id)
			}

			return nil
		},
	}

	cmd.Flags().String("title", "", "new title")
	cmd.Flags().String("priority", "", "new priority (0-4)")
	cmd.Flags().StringP("description", "d", "", "new description")
	cmd.Flags().String("branch", "", "branch name")
	cmd.Flags().StringSlice("add-tag", nil, "tag to add (repeatable)")
	cmd.Flags().StringSlice("remove-tag", nil, "tag to remove (repeatable)")
	cmd.Flags().StringArray("ac-add", nil, "add acceptance criteria as JSON (repeatable)")
	cmd.Flags().StringArray("ac-update", nil, "update acceptance criteria as JSON (repeatable)")
	cmd.Flags().StringArray("ac-remove", nil, "remove acceptance criteria by ID (repeatable)")
	cmd.Flags().Bool("human", false, "human-readable output")

	c.Command = cmd
	return c
}
