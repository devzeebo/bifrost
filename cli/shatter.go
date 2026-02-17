package cli

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
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
				fmt.Fprintf(out, "Shatter rune %s? This is irreversible. [y/N] ", id)
				line, _ := bufio.NewReader(in).ReadString('\n')
				answer := strings.TrimSpace(strings.ToLower(line))
				if answer != "y" && answer != "yes" {
					out.WriteString("Aborted")
					return nil
				}
			}

			body := map[string]string{"id": id}
			jsonBody, err := json.Marshal(body)
			if err != nil {
				return err
			}

			resp, err := clientFn().DoPost("/shatter-rune", jsonBody)
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
