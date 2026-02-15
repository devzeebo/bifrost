package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"

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

			jsonBody, err := json.Marshal(body)
			if err != nil {
				return err
			}

			resp, err := clientFn().DoPost("/seal-rune", jsonBody)
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
