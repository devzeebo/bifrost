package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

// --- RunnerSettings Create ---

type RunnerSettingsCreateCmd struct {
	Command *cobra.Command
}

func NewRunnerSettingsCreateCmd(clientFn func() *Client, out *bytes.Buffer) *RunnerSettingsCreateCmd {
	c := &RunnerSettingsCreateCmd{}

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create new runner settings",
		RunE: func(cmd *cobra.Command, args []string) error {
			runnerType, _ := cmd.Flags().GetString("runner-type")
			name, _ := cmd.Flags().GetString("name")
			humanMode, _ := cmd.Flags().GetBool("human")

			body := map[string]any{
				"runner_type": runnerType,
				"name":        name,
			}

			jsonBody, err := json.Marshal(body)
			if err != nil {
				return err
			}

			resp, err := clientFn().DoPost("/api/runner-settings", jsonBody)
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

			return PrintOutput(out, respBody, humanMode, func(w *bytes.Buffer, data []byte) {
				var result struct {
					RunnerSettingsID string `json:"runner_settings_id"`
					Name             string `json:"name"`
				}
				if json.Unmarshal(data, &result) != nil {
					return
				}
				fmt.Fprintf(w, "Created runner settings %s: %s\n", result.RunnerSettingsID, result.Name)
			})
		},
	}

	cmd.Flags().String("runner-type", "", "Runner type (e.g., cursor-cli, windsurf-cli)")
	cmd.Flags().String("name", "", "Settings name")
	cmd.Flags().Bool("human", false, "Human-readable output")
	_ = cmd.MarkFlagRequired("runner-type")
	_ = cmd.MarkFlagRequired("name")

	c.Command = cmd
	return c
}

// --- RunnerSettings List ---

type RunnerSettingsListCmd struct {
	Command *cobra.Command
}

func NewRunnerSettingsListCmd(clientFn func() *Client, out *bytes.Buffer) *RunnerSettingsListCmd {
	c := &RunnerSettingsListCmd{}

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List all runner settings",
		RunE: func(cmd *cobra.Command, args []string) error {
			humanMode, _ := cmd.Flags().GetBool("human")

			resp, err := clientFn().DoGet("/api/runner-settings", nil)
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

			return PrintOutput(out, respBody, humanMode, func(w *bytes.Buffer, data []byte) {
				var settings []map[string]any
				if json.Unmarshal(data, &settings) != nil {
					return
				}
				tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
				fmt.Fprintf(tw, "ID\tType\tName\n")
				for _, s := range settings {
					id, _ := s["runner_settings_id"].(string)
					runnerType, _ := s["runner_type"].(string)
					name, _ := s["name"].(string)
					fmt.Fprintf(tw, "%s\t%s\t%s\n", id, runnerType, name)
				}
				tw.Flush()
			})
		},
	}

	cmd.Flags().Bool("human", false, "Human-readable output")

	c.Command = cmd
	return c
}

// --- RunnerSettings Show ---

type RunnerSettingsShowCmd struct {
	Command *cobra.Command
}

func NewRunnerSettingsShowCmd(clientFn func() *Client, out *bytes.Buffer) *RunnerSettingsShowCmd {
	c := &RunnerSettingsShowCmd{}

	cmd := &cobra.Command{
		Use:   "show <runner-settings-id>",
		Short: "Show runner settings details",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			settingsID := args[0]
			humanMode, _ := cmd.Flags().GetBool("human")

			resp, err := clientFn().DoGet("/api/runner-settings/"+settingsID, nil)
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

			return PrintOutput(out, respBody, humanMode, func(w *bytes.Buffer, data []byte) {
				var settings struct {
					RunnerSettingsID string            `json:"runner_settings_id"`
					RunnerType       string            `json:"runner_type"`
					Name             string            `json:"name"`
					Fields           map[string]string `json:"fields"`
				}
				if json.Unmarshal(data, &settings) != nil {
					return
				}
				fmt.Fprintf(w, "Runner Settings ID: %s\n", settings.RunnerSettingsID)
				fmt.Fprintf(w, "Runner Type: %s\n", settings.RunnerType)
				fmt.Fprintf(w, "Name: %s\n", settings.Name)
				if len(settings.Fields) > 0 {
					fmt.Fprintf(w, "Fields:\n")
					for k, v := range settings.Fields {
						fmt.Fprintf(w, "  %s: %s\n", k, v)
					}
				}
			})
		},
	}

	cmd.Flags().Bool("human", false, "Human-readable output")

	c.Command = cmd
	return c
}

// --- RunnerSettings SetField ---

type RunnerSettingsSetFieldCmd struct {
	Command *cobra.Command
}

func NewRunnerSettingsSetFieldCmd(clientFn func() *Client, out *bytes.Buffer) *RunnerSettingsSetFieldCmd {
	c := &RunnerSettingsSetFieldCmd{}

	cmd := &cobra.Command{
		Use:   "set-field <runner-settings-id> <key> <value>",
		Short: "Set a field in runner settings",
		Args:  cobra.ExactArgs(3),
		RunE: func(cmd *cobra.Command, args []string) error {
			settingsID := args[0]
			key := args[1]
			value := args[2]
			humanMode, _ := cmd.Flags().GetBool("human")

			body := map[string]any{
				"key":   key,
				"value": value,
			}

			jsonBody, err := json.Marshal(body)
			if err != nil {
				return err
			}

			resp, err := clientFn().DoRequest(http.MethodPut, "/api/runner-settings/"+settingsID+"/fields", jsonBody)
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

			return PrintOutput(out, respBody, humanMode, func(w *bytes.Buffer, data []byte) {
				fmt.Fprintf(w, "Set field %s on %s\n", key, settingsID)
			})
		},
	}

	cmd.Flags().Bool("human", false, "Human-readable output")

	c.Command = cmd
	return c
}

// --- RunnerSettings Delete ---

type RunnerSettingsDeleteCmd struct {
	Command *cobra.Command
}

func NewRunnerSettingsDeleteCmd(clientFn func() *Client, out *bytes.Buffer) *RunnerSettingsDeleteCmd {
	c := &RunnerSettingsDeleteCmd{}

	cmd := &cobra.Command{
		Use:   "delete <runner-settings-id>",
		Short: "Delete runner settings",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			settingsID := args[0]
			humanMode, _ := cmd.Flags().GetBool("human")

			resp, err := clientFn().DoRequest(http.MethodDelete, "/api/runner-settings/"+settingsID, nil)
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

			return PrintOutput(out, respBody, humanMode, func(w *bytes.Buffer, data []byte) {
				fmt.Fprintf(w, "Deleted runner settings %s\n", settingsID)
			})
		},
	}

	cmd.Flags().Bool("human", false, "Human-readable output")

	c.Command = cmd
	return c
}

// --- RunnerSettings Command Group ---

type RunnerSettingsCmd struct {
	Command *cobra.Command
}

func NewRunnerSettingsCmd(clientFn func() *Client, out *bytes.Buffer) *RunnerSettingsCmd {
	c := &RunnerSettingsCmd{}

	cmd := &cobra.Command{
		Use:   "runner-settings",
		Short: "Manage runner settings",
	}

	cmd.AddCommand(NewRunnerSettingsCreateCmd(clientFn, out).Command)
	cmd.AddCommand(NewRunnerSettingsListCmd(clientFn, out).Command)
	cmd.AddCommand(NewRunnerSettingsShowCmd(clientFn, out).Command)
	cmd.AddCommand(NewRunnerSettingsSetFieldCmd(clientFn, out).Command)
	cmd.AddCommand(NewRunnerSettingsDeleteCmd(clientFn, out).Command)

	c.Command = cmd
	return c
}
