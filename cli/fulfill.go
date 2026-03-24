package cli

import (
	"bytes"
	"fmt"

	"github.com/spf13/cobra"
)

type FulfillCmd struct {
	Command *cobra.Command
}

func NewFulfillCmd(clientFn func() *Client, out *bytes.Buffer) *FulfillCmd {
	c := &FulfillCmd{}

	cmd := &cobra.Command{
		Use:   "fulfill [id]",
		Short: "Fulfill a rune",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]
			humanMode, _ := cmd.Flags().GetBool("human")

			body := map[string]string{"id": id}

			_, err := clientFn().DoPost("/fulfill-rune", body)
			if err != nil {
				return err
			}

			if humanMode {
				fmt.Fprintf(out, "Rune %s fulfilled", id)
			}

			return nil
		},
	}

	cmd.Flags().Bool("human", false, "human-readable output")

	c.Command = cmd
	return c
}
