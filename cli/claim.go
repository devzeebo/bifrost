package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os/user"

	"github.com/spf13/cobra"
)

type ClaimCmd struct {
	Command *cobra.Command
}

func NewClaimCmd(clientFn func() *Client, out *bytes.Buffer) *ClaimCmd {
	c := &ClaimCmd{}

	cmd := &cobra.Command{
		Use:   "claim [id]",
		Short: "Claim a rune",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]
			claimant, _ := cmd.Flags().GetString("as")
			humanMode, _ := cmd.Flags().GetBool("human")

			if claimant == "" {
				u, err := user.Current()
				if err == nil {
					claimant = u.Username
				}
			}

			body := map[string]string{
				"id":       id,
				"claimant": claimant,
			}

			jsonBody, err := json.Marshal(body)
			if err != nil {
				return err
			}

			resp, err := clientFn().DoPost("/claim-rune", jsonBody)
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
				fmt.Fprintf(out, "Rune %s claimed", id)
			}

			return nil
		},
	}

	cmd.Flags().String("as", "", "claimant name (defaults to system username)")
	cmd.Flags().Bool("human", false, "human-readable output")

	c.Command = cmd
	return c
}
