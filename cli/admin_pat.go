package cli

import (
	"encoding/json"
	"fmt"
	"text/tabwriter"

	"github.com/devzeebo/bifrost/domain"
	"github.com/spf13/cobra"
)

func addAdminPATCommands(admin *AdminCmd) {
	admin.Command.AddCommand(newAdminCreatePATCmd(admin))
	admin.Command.AddCommand(newAdminListPATsCmd(admin))
	admin.Command.AddCommand(newAdminRevokePATCmd(admin))
}

func newAdminCreatePATCmd(admin *AdminCmd) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "create-pat <username>",
		Short: "Create a personal access token for an account",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			jsonMode, _ := cmd.Flags().GetBool("json")
			label, _ := cmd.Flags().GetString("label")
			ctx := cmd.Context()

			accountID, err := resolveUsername(ctx, admin.Ctx.ProjectionStore, args[0])
			if err != nil {
				return err
			}

			result, err := domain.HandleCreatePAT(ctx, domain.CreatePAT{
				AccountID: accountID,
				Label:     label,
			}, admin.Ctx.EventStore)
			if err != nil {
				return err
			}

			events, err := admin.Ctx.EventStore.ReadStream(ctx, "_admin", "account-"+accountID, 0)
			if err != nil {
				return err
			}
			if err := syncProjections(ctx, admin.Ctx, events); err != nil {
				return err
			}

			if jsonMode {
				out, _ := json.Marshal(map[string]string{
					"pat_id": result.PATID,
					"token":  result.RawToken,
				})
				fmt.Fprintln(cmd.OutOrStdout(), string(out))
				return nil
			}

			fmt.Fprintf(cmd.OutOrStdout(), "PAT ID: %s\n", result.PATID)
			fmt.Fprintf(cmd.OutOrStdout(), "Token: %s\n", result.RawToken)
			fmt.Fprintln(cmd.OutOrStdout(), "Save this token — it will not be shown again")
			return nil
		},
	}

	cmd.Flags().String("label", "", "optional label for the PAT")

	return cmd
}

func newAdminListPATsCmd(admin *AdminCmd) *cobra.Command {
	return &cobra.Command{
		Use:   "list-pats <username>",
		Short: "List personal access tokens for an account",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			jsonMode, _ := cmd.Flags().GetBool("json")
			ctx := cmd.Context()

			accountID, err := resolveUsername(ctx, admin.Ctx.ProjectionStore, args[0])
			if err != nil {
				return err
			}

			events, err := admin.Ctx.EventStore.ReadStream(ctx, "_admin", "account-"+accountID, 0)
			if err != nil {
				return err
			}

			state := domain.RebuildAccountState(events)

			type patEntry struct {
				PATID   string `json:"pat_id"`
				Label   string `json:"label"`
				Revoked bool   `json:"revoked"`
			}

			var pats []patEntry
			for _, pat := range state.PATs {
				pats = append(pats, patEntry{
					PATID:   pat.PATID,
					Label:   pat.Label,
					Revoked: pat.Revoked,
				})
			}

			if jsonMode {
				out, _ := json.Marshal(pats)
				fmt.Fprintln(cmd.OutOrStdout(), string(out))
				return nil
			}

			w := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 0, 2, ' ', 0)
			fmt.Fprintln(w, "PAT ID\tLabel\tRevoked")
			fmt.Fprintln(w, "------\t-----\t-------")
			for _, p := range pats {
				fmt.Fprintf(w, "%s\t%s\t%v\n", p.PATID, p.Label, p.Revoked)
			}
			w.Flush()
			return nil
		},
	}
}

func newAdminRevokePATCmd(admin *AdminCmd) *cobra.Command {
	return &cobra.Command{
		Use:   "revoke-pat <username> <pat-id>",
		Short: "Revoke a personal access token",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			jsonMode, _ := cmd.Flags().GetBool("json")
			ctx := cmd.Context()

			accountID, err := resolveUsername(ctx, admin.Ctx.ProjectionStore, args[0])
			if err != nil {
				return err
			}

			err = domain.HandleRevokePAT(ctx, domain.RevokePAT{
				AccountID: accountID,
				PATID:     args[1],
			}, admin.Ctx.EventStore)
			if err != nil {
				return err
			}

			events, err := admin.Ctx.EventStore.ReadStream(ctx, "_admin", "account-"+accountID, 0)
			if err != nil {
				return err
			}
			if err := syncProjections(ctx, admin.Ctx, events); err != nil {
				return err
			}

			if jsonMode {
				out, _ := json.Marshal(map[string]string{
					"status": "revoked",
				})
				fmt.Fprintln(cmd.OutOrStdout(), string(out))
				return nil
			}

			fmt.Fprintf(cmd.OutOrStdout(), "PAT %s revoked\n", args[1])
			return nil
		},
	}
}
