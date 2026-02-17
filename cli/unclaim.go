package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"

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

			jsonBody, err := json.Marshal(body)
			if err != nil {
				return err
			}

			resp, err := clientFn().DoPost("/unclaim-rune", jsonBody)
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
				fmt.Fprintf(out, "Rune %s unclaimed", id)
			}

			return nil
		},
	}

	cmd.Flags().Bool("human", false, "human-readable output")

	c.Command = cmd
	return c
}
