package cli

import (
	"bytes"
	"fmt"

	"github.com/spf13/cobra"
)

type ReopenCmd struct {
	Command *cobra.Command
}

func NewReopenCmd(clientFn func() *Client, out *bytes.Buffer) *ReopenCmd {
	c := &ReopenCmd{}

	cmd := &cobra.Command{
		Use:   "reopen [id]",
		Short: "Reopen a failed rune",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]
			asClaimed, _ := cmd.Flags().GetBool("claim")
			humanMode, _ := cmd.Flags().GetBool("human")

			body := map[string]any{"id": id, "as_claimed": asClaimed}

			_, err := clientFn().DoPost("/reopen-rune", body)
			if err != nil {
				return err
			}

			if humanMode {
				fmt.Fprintf(out, "Rune %s reopened", id)
			}

			return nil
		},
	}

	cmd.Flags().Bool("claim", false, "reopen as claimed (preserves claimant)")
	cmd.Flags().Bool("human", false, "human-readable output")

	c.Command = cmd
	return c
}
