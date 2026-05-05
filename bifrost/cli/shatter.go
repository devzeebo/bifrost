package cli

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

type ShatterCmd struct {
	Command *cobra.Command
}

func NewShatterCmd(clientFn func() *Client, out *bytes.Buffer, in io.Reader) *ShatterCmd {
	c := &ShatterCmd{}

	cmd := &cobra.Command{
		Use:   "shatter [id]",
		Short: "Shatter a rune (irreversible tombstone)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]
			confirm, _ := cmd.Flags().GetBool("confirm")
			humanMode, _ := cmd.Flags().GetBool("human")

			if !confirm {
				fmt.Fprintf(os.Stdout, "Shatter rune %s? This is irreversible. [y/N] ", id)
				_ = os.Stdout.Sync()
				line, err := bufio.NewReader(in).ReadString('\n')
				if err != nil && err != io.EOF {
					return fmt.Errorf("failed to read user input: %w", err)
				}
				answer := strings.TrimSpace(strings.ToLower(line))
				if answer != "y" && answer != "yes" {
					fmt.Fprintln(out, "Aborted")
					return nil
				}
			}

			body := map[string]string{"id": id}

			_, err := clientFn().DoPost("/shatter-rune", body)
			if err != nil {
				return err
			}

			if humanMode {
				fmt.Fprintf(out, "Rune %s shattered", id)
			}

			return nil
		},
	}

	cmd.Flags().Bool("confirm", false, "skip interactive confirmation prompt")
	cmd.Flags().Bool("human", false, "human-readable output")

	c.Command = cmd
	return c
}
