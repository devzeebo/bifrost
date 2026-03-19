package cli

import (
	"bytes"
	"fmt"

	"github.com/spf13/cobra"
)

type UnclaimCmd struct {
	Command *cobra.Command
}

func NewUnclaimCmd(clientFn func() *Client, out *bytes.Buffer) *UnclaimCmd {
	c := &UnclaimCmd{}

	cmd := &cobra.Command{
		Use:   "unclaim [id]",
		Short: "Unclaim a rune",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]
			humanMode, _ := cmd.Flags().GetBool("human")

			body := map[string]string{
				"id": id,
			}

			_, err := clientFn().DoPost("/unclaim-rune", body)
			if err != nil {
				return err
			}

			if humanMode {
				fmt.Fprintf(out, "Rune %s unclaimed", id)
			}

			return nil
		},
	}

	cmd.Flags().Bool("human", false, "human-readable output")

	c.Command = cmd
	return c
}
