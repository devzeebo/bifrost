package cli

import (
	"bytes"
	"fmt"

	"github.com/spf13/cobra"
)

type ForgeCmd struct {
	Command *cobra.Command
}

func NewForgeCmd(clientFn func() *Client, out *bytes.Buffer) *ForgeCmd {
	c := &ForgeCmd{}

	cmd := &cobra.Command{
		Use:   "forge [id]",
		Short: "Forge a rune (move from draft to open)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]
			humanMode, _ := cmd.Flags().GetBool("human")

			body := map[string]string{
				"id": id,
			}

			_, err := clientFn().DoPost("/forge-rune", body)
			if err != nil {
				return err
			}

			if humanMode {
				fmt.Fprintf(out, "Forged rune %s", id)
			}

			return nil
		},
	}

	cmd.Flags().Bool("human", false, "human-readable output")

	c.Command = cmd
	return c
}
