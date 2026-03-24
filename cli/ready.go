package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sort"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

type ReadyCmd struct {
	Command *cobra.Command
}

func NewReadyCmd(clientFn func() *Client, out *bytes.Buffer) *ReadyCmd {
	c := &ReadyCmd{}

	cmd := &cobra.Command{
		Use:   "ready",
		Short: "List ready runes (unblocked and unclaimed)",
		RunE: func(cmd *cobra.Command, args []string) error {
			humanMode, _ := cmd.Flags().GetBool("human")
			showSagas, _ := cmd.Flags().GetBool("sagas")
			saga, _ := cmd.Flags().GetString("saga")

			params := map[string]string{"status": "open", "blocked": "false"}
			if !showSagas {
				params["is_saga"] = "false"
			}
			if saga != "" {
				params["saga"] = saga
			}

			respBody, err := clientFn().DoGetWithParams("/runes", params)
			if err != nil {
				return err
			}

			{
				var runes []map[string]any
				if json.Unmarshal(respBody, &runes) == nil {
					sort.SliceStable(runes, func(i, j int) bool {
						pi, _ := runes[i]["priority"].(float64)
						pj, _ := runes[j]["priority"].(float64)
						return pi < pj
					})

					if !humanMode {
						allowed := map[string]bool{"id": true, "title": true, "status": true, "priority": true}
						for i, r := range runes {
							filtered := make(map[string]any, len(allowed))
							for k, v := range r {
								if allowed[k] {
									filtered[k] = v
								}
							}
							runes[i] = filtered
						}
					}

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

	cmd.Flags().Bool("human", false, "human-readable table output")
	cmd.Flags().Bool("sagas", false, "include sagas in output")
	cmd.Flags().String("saga", "", "filter by parent saga ID")

	c.Command = cmd
	return c
}
