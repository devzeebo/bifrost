package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
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

			jsonBody, err := json.Marshal(body)
			if err != nil {
				return err
			}

			resp, err := clientFn().DoPost("/create-rune", jsonBody)
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

	c.Command = cmd
	return c
}
