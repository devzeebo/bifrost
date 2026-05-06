package cli

import (
	"bytes"
	"fmt"

	"github.com/spf13/cobra"
)

type FailCmd struct {
	Command *cobra.Command
}

func NewFailCmd(clientFn func() *Client, out *bytes.Buffer) *FailCmd {
	c := &FailCmd{}

	cmd := &cobra.Command{
		Use:   "fail [id] --reason [text]",
		Short: "Mark a rune as failed",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]
			reason, _ := cmd.Flags().GetString("reason")
			humanMode, _ := cmd.Flags().GetBool("human")

			if reason == "" {
				return fmt.Errorf("--reason is required")
			}

			body := map[string]string{"id": id, "reason": reason}

			_, err := clientFn().DoPost("/fail-rune", body)
			if err != nil {
				return err
			}

			if humanMode {
				fmt.Fprintf(out, "Rune %s marked as failed", id)
			}

			return nil
		},
	}

	cmd.Flags().String("reason", "", "reason for failure (required)")
	cmd.Flags().Bool("human", false, "human-readable output")

	c.Command = cmd
	return c
}
