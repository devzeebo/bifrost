package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

// --- Agent Create ---

type AgentCreateCmd struct {
	Command *cobra.Command
}

func NewAgentCreateCmd(clientFn func() *Client, out *bytes.Buffer) *AgentCreateCmd {
	c := &AgentCreateCmd{}

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new agent",
		RunE: func(cmd *cobra.Command, args []string) error {
			name, _ := cmd.Flags().GetString("name")
			mainWorkflow, _ := cmd.Flags().GetString("main-workflow")
			humanMode, _ := cmd.Flags().GetBool("human")

			body := map[string]any{"name": name}
			if mainWorkflow != "" {
				body["main_workflow_id"] = mainWorkflow
			}

			jsonBody, err := json.Marshal(body)
			if err != nil {
				return err
			}

			resp, err := clientFn().DoPost("/api/agents", jsonBody)
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
					AgentID string `json:"agent_id"`
					Name    string `json:"name"`
				}
				if json.Unmarshal(data, &result) != nil {
					return
				}
				fmt.Fprintf(w, "Created agent %s: %s\n", result.AgentID, result.Name)
			})
		},
	}

	cmd.Flags().String("name", "", "Agent name")
	cmd.Flags().String("main-workflow", "", "Main workflow ID")
	cmd.Flags().Bool("human", false, "Human-readable output")
	_ = cmd.MarkFlagRequired("name")

	c.Command = cmd
	return c
}

// --- Agent List ---

type AgentListCmd struct {
	Command *cobra.Command
}

func NewAgentListCmd(clientFn func() *Client, out *bytes.Buffer) *AgentListCmd {
	c := &AgentListCmd{}

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List all agents",
		RunE: func(cmd *cobra.Command, args []string) error {
			humanMode, _ := cmd.Flags().GetBool("human")

			resp, err := clientFn().DoGet("/api/agents", nil)
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
				var agents []map[string]any
				if json.Unmarshal(data, &agents) != nil {
					return
				}
				tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
				fmt.Fprintf(tw, "ID\tName\n")
				for _, a := range agents {
					id, _ := a["agent_id"].(string)
					name, _ := a["name"].(string)
					fmt.Fprintf(tw, "%s\t%s\n", id, name)
				}
				tw.Flush()
			})
		},
	}

	cmd.Flags().Bool("human", false, "Human-readable output")

	c.Command = cmd
	return c
}

// --- Agent Show ---

type AgentShowCmd struct {
	Command *cobra.Command
}

func NewAgentShowCmd(clientFn func() *Client, out *bytes.Buffer) *AgentShowCmd {
	c := &AgentShowCmd{}

	cmd := &cobra.Command{
		Use:   "show <agent-id>",
		Short: "Show agent details",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			agentID := args[0]
			humanMode, _ := cmd.Flags().GetBool("human")

			resp, err := clientFn().DoGet("/api/agents/"+agentID, nil)
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
				var agent struct {
					AgentID        string `json:"agent_id"`
					Name           string `json:"name"`
					MainWorkflowID string `json:"main_workflow_id"`
				}
				if json.Unmarshal(data, &agent) != nil {
					return
				}
				fmt.Fprintf(w, "Agent ID: %s\n", agent.AgentID)
				fmt.Fprintf(w, "Name: %s\n", agent.Name)
				if agent.MainWorkflowID != "" {
					fmt.Fprintf(w, "Main Workflow: %s\n", agent.MainWorkflowID)
				}
			})
		},
	}

	cmd.Flags().Bool("human", false, "Human-readable output")

	c.Command = cmd
	return c
}

// --- Agent Grant ---

type AgentGrantCmd struct {
	Command *cobra.Command
}

func NewAgentGrantCmd(clientFn func() *Client, out *bytes.Buffer) *AgentGrantCmd {
	c := &AgentGrantCmd{}

	cmd := &cobra.Command{
		Use:   "grant <realm-id> <agent-id>",
		Short: "Grant realm access to an agent",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			realmID := args[0]
			agentID := args[1]
			humanMode, _ := cmd.Flags().GetBool("human")

			body := map[string]any{"realm_id": realmID}

			jsonBody, err := json.Marshal(body)
			if err != nil {
				return err
			}

			resp, err := clientFn().DoPost("/api/agents/"+agentID+"/grant", jsonBody)
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
				fmt.Fprintf(w, "Granted realm %s to agent %s\n", realmID, agentID)
			})
		},
	}

	cmd.Flags().Bool("human", false, "Human-readable output")

	c.Command = cmd
	return c
}

// --- Agent Revoke ---

type AgentRevokeCmd struct {
	Command *cobra.Command
}

func NewAgentRevokeCmd(clientFn func() *Client, out *bytes.Buffer) *AgentRevokeCmd {
	c := &AgentRevokeCmd{}

	cmd := &cobra.Command{
		Use:   "revoke <realm-id> <agent-id>",
		Short: "Revoke realm access from an agent",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			realmID := args[0]
			agentID := args[1]
			humanMode, _ := cmd.Flags().GetBool("human")

			body := map[string]any{"realm_id": realmID}

			jsonBody, err := json.Marshal(body)
			if err != nil {
				return err
			}

			resp, err := clientFn().DoPost("/api/agents/"+agentID+"/revoke", jsonBody)
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
				fmt.Fprintf(w, "Revoked realm %s from agent %s\n", realmID, agentID)
			})
		},
	}

	cmd.Flags().Bool("human", false, "Human-readable output")

	c.Command = cmd
	return c
}

// --- Agent Command Group ---

type AgentCmd struct {
	Command *cobra.Command
}

func NewAgentCmd(clientFn func() *Client, out *bytes.Buffer) *AgentCmd {
	c := &AgentCmd{}

	cmd := &cobra.Command{
		Use:   "agent",
		Short: "Manage agents",
	}

	cmd.AddCommand(NewAgentCreateCmd(clientFn, out).Command)
	cmd.AddCommand(NewAgentListCmd(clientFn, out).Command)
	cmd.AddCommand(NewAgentShowCmd(clientFn, out).Command)
	cmd.AddCommand(NewAgentGrantCmd(clientFn, out).Command)
	cmd.AddCommand(NewAgentRevokeCmd(clientFn, out).Command)

	c.Command = cmd
	return c
}
