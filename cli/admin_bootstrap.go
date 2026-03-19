package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/spf13/cobra"
)

func addAdminBootstrapCommands(admin *AdminCmd) {
	cmd := &cobra.Command{
		Use:   "bootstrap",
		Short: "Bootstrap a new Bifrost installation",
		Long: `Bootstrap creates the initial sysadmin account and optionally a realm.

This command calls the unauthenticated onboarding endpoint and should only
work when no sysadmin exists yet. It outputs the initial PAT for the sysadmin
account, which should be saved and used for further admin operations.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			url, _ := cmd.Flags().GetString("url")
			if url == "" {
				url = os.Getenv("BIFROST_URL")
			}
			if url == "" {
				return fmt.Errorf("server URL required (set --url flag or BIFROST_URL env)")
			}

			username, _ := cmd.Flags().GetString("username")
			realmName, _ := cmd.Flags().GetString("realm")
			jsonMode, _ := cmd.Flags().GetBool("json")

			req := map[string]interface{}{
				"create_sysadmin": username != "",
				"username":        username,
				"create_realm":    realmName != "",
				"realm_name":      realmName,
			}

			resp, err := doBootstrapRequest(url, req)
			if err != nil {
				return err
			}

			if jsonMode {
				fmt.Fprintln(cmd.OutOrStdout(), string(resp))
				return nil
			}

			var result struct {
				AccountID string `json:"account_id"`
				PAT       string `json:"pat"`
				RealmID   string `json:"realm_id"`
			}
			if err := json.Unmarshal(resp, &result); err != nil {
				return err
			}

			if result.AccountID != "" {
				fmt.Fprintf(cmd.OutOrStdout(), "Account ID: %s\n", result.AccountID)
				fmt.Fprintf(cmd.OutOrStdout(), "PAT: %s\n", result.PAT)
				fmt.Fprintln(cmd.OutOrStdout(), "Save this PAT — it will not be shown again")
			}
			if result.RealmID != "" {
				fmt.Fprintf(cmd.OutOrStdout(), "Realm ID: %s\n", result.RealmID)
			}
			return nil
		},
	}

	cmd.Flags().String("url", "", "Bifrost server URL (env: BIFROST_URL)")
	cmd.Flags().String("username", "", "Username for the initial sysadmin account")
	cmd.Flags().String("realm", "", "Name for the initial realm (optional)")
	cmd.Flags().Bool("json", false, "Output in JSON format")

	admin.Command.AddCommand(cmd)
}

func doBootstrapRequest(baseURL string, req map[string]interface{}) ([]byte, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	url := baseURL + "/api/ui/onboarding/create-admin"
	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusCreated {
		var errResp struct {
			Error string `json:"error"`
		}
		if json.Unmarshal(respBody, &errResp) == nil && errResp.Error != "" {
			return nil, fmt.Errorf("%s", errResp.Error)
		}
		return nil, fmt.Errorf("bootstrap failed: %s", resp.Status)
	}

	return respBody, nil
}
