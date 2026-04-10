package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

type ListCmd struct {
	Command *cobra.Command
}

func NewListCmd(clientFn func() *Client, out *bytes.Buffer) *ListCmd {
	c := &ListCmd{}

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List runes",
		RunE: func(cmd *cobra.Command, args []string) error {
			status, _ := cmd.Flags().GetString("status")
			priority, _ := cmd.Flags().GetString("priority")
			assignee, _ := cmd.Flags().GetString("assignee")
			branch, _ := cmd.Flags().GetString("branch")
			saga, _ := cmd.Flags().GetString("saga")
			tags, _ := cmd.Flags().GetStringSlice("tag")
			humanMode, _ := cmd.Flags().GetBool("human")

			params := map[string]string{}
			if status != "" {
				params["status"] = status
			}
			if priority != "" {
				params["priority"] = priority
			}
			if assignee != "" {
				params["assignee"] = assignee
			}
			if branch != "" {
				params["branch"] = branch
			}
			if saga != "" {
				params["saga"] = saga
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
					params["tags"] = strings.Join(normalized, ",")
				}
			}

			respBody, err := clientFn().DoGetWithParams("/runes", params)
			if err != nil {
				return err
			}

			// Apply sorting before output
			{
				var runes []map[string]any
				if json.Unmarshal(respBody, &runes) == nil {
					sortRunes(runes)
					if b, err := json.Marshal(runes); err == nil {
						respBody = b
					}
				}
			}

			return PrintOutput(out, respBody, humanMode, func(w *bytes.Buffer, data []byte) {
				var runes []map[string]any
				if json.Unmarshal(data, &runes) != nil {
					return
				}
				tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
				fmt.Fprintf(tw, "ID\tTitle\tStatus\tPriority\tAssignee\tBranch\n")
				for _, r := range runes {
					id, _ := r["id"].(string)
					title, _ := r["title"].(string)
					st, _ := r["status"].(string)
					p := ""
					if pv, ok := r["priority"].(float64); ok {
						p = fmt.Sprintf("%d", int(pv))
					}
					claimant, _ := r["claimant"].(string)
					br, _ := r["branch"].(string)
					fmt.Fprintf(tw, "%s\t%s\t%s\t%s\t%s\t%s\n", id, title, st, p, claimant, br)
				}
				tw.Flush()
			})
		},
	}

	cmd.Flags().String("status", "", "filter by status (open|claimed|fulfilled|sealed)")
	cmd.Flags().String("priority", "", "filter by priority (0-4)")
	cmd.Flags().String("assignee", "", "filter by assignee name")
	cmd.Flags().String("branch", "", "filter by branch name")
	cmd.Flags().String("saga", "", "filter by parent saga ID")
	cmd.Flags().StringSlice("tag", nil, "filter by tag (repeatable)")
	cmd.Flags().Bool("human", false, "human-readable table output")

	c.Command = cmd
	return c
}
