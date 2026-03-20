package cli

import (
	"bytes"
	"fmt"
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

			_, err := clientFn().DoPost("/update-rune", body)
			if err != nil {
				return err
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
