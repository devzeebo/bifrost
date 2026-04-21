package cli

import (
	"bytes"
	"fmt"

	"github.com/spf13/cobra"
)

type SealCmd struct {
	Command *cobra.Command
}

func NewSealCmd(clientFn func() *Client, out *bytes.Buffer) *SealCmd {
	c := &SealCmd{}

	cmd := &cobra.Command{
		Use:   "seal [id]",
		Short: "Seal a rune",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]
			reason, _ := cmd.Flags().GetString("reason")
			humanMode, _ := cmd.Flags().GetBool("human")

			body := map[string]string{"id": id}
			if reason != "" {
				body["reason"] = reason
			}

			_, err := clientFn().DoPost("/seal-rune", body)
			if err != nil {
				return err
			}

			if humanMode {
				fmt.Fprintf(out, "Rune %s sealed", id)
			}

			return nil
		},
	}

	cmd.Flags().String("reason", "", "reason for sealing")
	cmd.Flags().Bool("human", false, "human-readable output")

	c.Command = cmd
	return c
}
