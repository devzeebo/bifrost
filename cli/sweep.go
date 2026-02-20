package cli

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

type SweepCmd struct {
	Command *cobra.Command
}

func NewSweepCmd(clientFn func() *Client, out *bytes.Buffer, in io.Reader) *SweepCmd {
	c := &SweepCmd{}

	cmd := &cobra.Command{
		Use:   "sweep",
		Short: "Shatter all unreferenced sealed/fulfilled runes",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			confirm, _ := cmd.Flags().GetBool("confirm")
			humanMode, _ := cmd.Flags().GetBool("human")

			if !confirm {
				fmt.Fprintf(os.Stdout, "Sweep will shatter all unreferenced sealed/fulfilled runes. Continue? [y/N] ")
				os.Stdout.Sync()
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

			resp, err := clientFn().DoPost("/sweep-runes", nil)
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
				var result struct {
					Shattered []string `json:"shattered"`
				}
				if err := json.Unmarshal(respBody, &result); err != nil {
					return err
				}
				if len(result.Shattered) == 0 {
					fmt.Fprintf(out, "No runes to sweep")
					return nil
				}
				fmt.Fprintf(out, "Shattered %d runes:\n", len(result.Shattered))
				for _, id := range result.Shattered {
					fmt.Fprintln(out, id)
				}
				return nil
			}

			_, err = out.Write(respBody)
			return err
		},
	}

	cmd.Flags().Bool("confirm", false, "skip interactive prompt")
	cmd.Flags().Bool("human", false, "human-readable output")

	c.Command = cmd
	return c
}
