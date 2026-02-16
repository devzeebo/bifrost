package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strconv"

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

			jsonBody, err := json.Marshal(body)
			if err != nil {
				return err
			}

			resp, err := clientFn().DoPost("/update-rune", jsonBody)
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
	cmd.Flags().Bool("human", false, "human-readable output")

	c.Command = cmd
	return c
}
