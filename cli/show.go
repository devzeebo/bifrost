package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

type ShowCmd struct {
	Command *cobra.Command
}

func NewShowCmd(clientFn func() *Client, out *bytes.Buffer) *ShowCmd {
	c := &ShowCmd{}

	cmd := &cobra.Command{
		Use:   "show [id]",
		Short: "Show rune details",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]
			humanMode, _ := cmd.Flags().GetBool("human")

			respBody, err := clientFn().DoGetWithParams("/rune", map[string]string{"id": id})
			if err != nil {
				return err
			}

			return PrintOutput(out, respBody, humanMode, func(w *bytes.Buffer, data []byte) {
				var result map[string]any
				if json.Unmarshal(data, &result) == nil {
					id, _ := result["id"].(string)
					title, _ := result["title"].(string)
					status, _ := result["status"].(string)
					desc, _ := result["description"].(string)
					claimant, _ := result["claimant"].(string)

					fmt.Fprintf(w, "ID:          %s\n", id)
					fmt.Fprintf(w, "Title:       %s\n", title)
					fmt.Fprintf(w, "Status:      %s\n", status)
					if priority, ok := result["priority"].(float64); ok {
						fmt.Fprintf(w, "Priority:    %d\n", int(priority))
					}
					if branch, ok := result["branch"].(string); ok && branch != "" {
						fmt.Fprintf(w, "Branch:      %s\n", branch)
					}
					if desc != "" {
						fmt.Fprintf(w, "Description: %s\n", desc)
					}
					if claimant != "" {
						fmt.Fprintf(w, "Claimant:    %s\n", claimant)
					}
					if tags, ok := result["tags"].([]any); ok && len(tags) > 0 {
						rendered := make([]string, 0, len(tags))
						for _, raw := range tags {
							if tag, ok := raw.(string); ok && tag != "" {
								rendered = append(rendered, tag)
							}
						}
						if len(rendered) > 0 {
							fmt.Fprintf(w, "Tags:        %s\n", strings.Join(rendered, ", "))
						}
					}
					if deps, ok := result["dependencies"].([]any); ok && len(deps) > 0 {
						fmt.Fprintf(w, "Dependencies:\n")
						for _, d := range deps {
							fmt.Fprintf(w, "  - %v\n", d)
						}
					}
					if notes, ok := result["notes"].([]any); ok && len(notes) > 0 {
						fmt.Fprintf(w, "Notes:\n")
						for _, n := range notes {
							fmt.Fprintf(w, "  - %v\n", n)
						}
					}
				}
			})
		},
	}

	cmd.Flags().Bool("human", false, "human-readable output")

	c.Command = cmd
	return c
}
