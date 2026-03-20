package cli

import (
	"bytes"
	"fmt"

	"github.com/spf13/cobra"
)

type NoteCmd struct {
	Command *cobra.Command
}

func NewNoteCmd(clientFn func() *Client, out *bytes.Buffer) *NoteCmd {
	c := &NoteCmd{}

	cmd := &cobra.Command{
		Use:   "note [id] [text]",
		Short: "Add a note to a rune",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]
			text := args[1]
			humanMode, _ := cmd.Flags().GetBool("human")

			body := map[string]string{
				"rune_id": id,
				"text":    text,
			}

			_, err := clientFn().DoPost("/add-note", body)
			if err != nil {
				return err
			}

			if humanMode {
				fmt.Fprintf(out, "Note added to rune %s", id)
			}

			return nil
		},
	}

	cmd.Flags().Bool("human", false, "human-readable output")

	c.Command = cmd
	return c
}
