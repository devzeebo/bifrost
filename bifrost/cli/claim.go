package cli

import (
	"bytes"
	"fmt"
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

			_, err := clientFn().DoPost("/claim-rune", body)
			if err != nil {
				return err
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
