package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"

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

			resp, err := clientFn().DoGet("/rune", map[string]string{"id": id})
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
