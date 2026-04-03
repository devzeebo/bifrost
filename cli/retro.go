package cli

import (
	"bytes"
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"
)

type RetroCmd struct {
	Command *cobra.Command
}

func NewRetroCmd(clientFn func() *Client, out *bytes.Buffer) *RetroCmd {
	c := &RetroCmd{}

	cmd := &cobra.Command{
		Use:   "retro [id] [text]",
		Short: "Add a retro item to a rune, or view retrospective for a rune or saga",
		Args:  cobra.RangeArgs(1, 2),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]
			humanMode, _ := cmd.Flags().GetBool("human")

			if len(args) == 2 {
				// Add a retro item
				text := args[1]
				body := map[string]string{
					"rune_id": id,
					"text":    text,
				}
				_, err := clientFn().DoPost("/add-retro", body)
				if err != nil {
					return err
				}
				if humanMode {
					fmt.Fprintf(out, "Retro item added to rune %s", id)
				}
				return nil
			}

			// Fetch retro for rune or saga
			respBody, err := clientFn().DoGetWithParams("/retro", map[string]string{"id": id})
			if err != nil {
				return err
			}

			return PrintOutput(out, respBody, humanMode, func(w *bytes.Buffer, data []byte) {
				// Try array first (saga response)
				var runeList []map[string]any
				if json.Unmarshal(data, &runeList) == nil {
					for i, rune := range runeList {
						if i > 0 {
							fmt.Fprintln(w)
						}
						printRuneRetro(w, rune)
					}
					return
				}
				// Single rune response
				var result map[string]any
				if json.Unmarshal(data, &result) == nil {
					printRuneRetro(w, result)
				}
			})
		},
	}

	cmd.Flags().Bool("human", false, "human-readable output")

	c.Command = cmd
	return c
}

func printRuneRetro(w *bytes.Buffer, rune map[string]any) {
	id, _ := rune["id"].(string)
	title, _ := rune["title"].(string)
	status, _ := rune["status"].(string)
	desc, _ := rune["description"].(string)

	fmt.Fprintf(w, "ID:          %s\n", id)
	fmt.Fprintf(w, "Title:       %s\n", title)
	fmt.Fprintf(w, "Status:      %s\n", status)
	if desc != "" {
		fmt.Fprintf(w, "Description: %s\n", desc)
	}

	items, _ := rune["retro_items"].([]any)
	if len(items) == 0 {
		fmt.Fprintln(w, "Retrospective Items: (none)")
		return
	}
	fmt.Fprintln(w, "Retrospective Items:")
	for _, item := range items {
		entry, ok := item.(map[string]any)
		if !ok {
			continue
		}
		text, _ := entry["text"].(string)
		createdAt, _ := entry["created_at"].(string)
		if createdAt != "" {
			fmt.Fprintf(w, "  [%s] %s\n", createdAt[:10], text)
		} else {
			fmt.Fprintf(w, "  - %s\n", text)
		}
	}
}
