package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
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

			resp, err := clientFn().DoGet("/runes", params)
			if err != nil {
				return err
			}
			defer resp.Body.Close()

			respBody, err := io.ReadAll(resp.Body)
			if err != nil {
				return err
			}

			if resp.StatusCode >= 400 {
				var errResp map[string]string
				if json.Unmarshal(respBody, &errResp) == nil {
					if msg, ok := errResp["error"]; ok {
						out.WriteString(msg)
						return fmt.Errorf("%s", msg)
					}
				}
				return fmt.Errorf("server error: %s", string(respBody))
			}

			return PrintOutput(out, respBody, humanMode, func(w *bytes.Buffer, data []byte) {
				var runes []map[string]any
				if json.Unmarshal(data, &runes) != nil {
					return
				}
				tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
				fmt.Fprintf(tw, "ID\tTitle\tStatus\tPriority\tAssignee\n")
				for _, r := range runes {
					id, _ := r["id"].(string)
					title, _ := r["title"].(string)
					st, _ := r["status"].(string)
					p := ""
					if pv, ok := r["priority"].(float64); ok {
						p = fmt.Sprintf("%d", int(pv))
					}
					claimant, _ := r["claimant"].(string)
					fmt.Fprintf(tw, "%s\t%s\t%s\t%s\t%s\n", id, title, st, p, claimant)
				}
				tw.Flush()
			})
		},
	}

	cmd.Flags().String("status", "", "filter by status (open|claimed|fulfilled|sealed)")
	cmd.Flags().String("priority", "", "filter by priority (0-4)")
	cmd.Flags().String("assignee", "", "filter by assignee name")
	cmd.Flags().Bool("human", false, "human-readable table output")

	c.Command = cmd
	return c
}
