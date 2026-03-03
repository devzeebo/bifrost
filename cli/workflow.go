package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

// --- Workflow Create ---

type WorkflowCreateCmd struct {
	Command *cobra.Command
}

func NewWorkflowCreateCmd(clientFn func() *Client, out *bytes.Buffer) *WorkflowCreateCmd {
	c := &WorkflowCreateCmd{}

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new workflow",
		RunE: func(cmd *cobra.Command, args []string) error {
			name, _ := cmd.Flags().GetString("name")
			contentPath, _ := cmd.Flags().GetString("content")
			humanMode, _ := cmd.Flags().GetBool("human")

			content, err := os.ReadFile(contentPath)
			if err != nil {
				return fmt.Errorf("read content file: %w", err)
			}

			body := map[string]any{
				"name":    name,
				"content": string(content),
			}

			jsonBody, err := json.Marshal(body)
			if err != nil {
				return err
			}

			resp, err := clientFn().DoPost("/api/workflows", jsonBody)
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
					WorkflowID string `json:"workflow_id"`
					Name       string `json:"name"`
				}
				if json.Unmarshal(data, &result) != nil {
					return
				}
				fmt.Fprintf(w, "Created workflow %s: %s\n", result.WorkflowID, result.Name)
			})
		},
	}

	cmd.Flags().String("name", "", "Workflow name")
	cmd.Flags().String("content", "", "Path to workflow content file")
	cmd.Flags().Bool("human", false, "Human-readable output")
	_ = cmd.MarkFlagRequired("name")
	_ = cmd.MarkFlagRequired("content")

	c.Command = cmd
	return c
}

// --- Workflow List ---

type WorkflowListCmd struct {
	Command *cobra.Command
}

func NewWorkflowListCmd(clientFn func() *Client, out *bytes.Buffer) *WorkflowListCmd {
	c := &WorkflowListCmd{}

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List all workflows",
		RunE: func(cmd *cobra.Command, args []string) error {
			humanMode, _ := cmd.Flags().GetBool("human")

			resp, err := clientFn().DoGet("/api/workflows", nil)
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
				var workflows []map[string]any
				if json.Unmarshal(data, &workflows) != nil {
					return
				}
				tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
				fmt.Fprintf(tw, "ID\tName\n")
				for _, wf := range workflows {
					id, _ := wf["workflow_id"].(string)
					name, _ := wf["name"].(string)
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

// --- Workflow Show ---

type WorkflowShowCmd struct {
	Command *cobra.Command
}

func NewWorkflowShowCmd(clientFn func() *Client, out *bytes.Buffer) *WorkflowShowCmd {
	c := &WorkflowShowCmd{}

	cmd := &cobra.Command{
		Use:   "show <workflow-id>",
		Short: "Show workflow details",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			workflowID := args[0]
			humanMode, _ := cmd.Flags().GetBool("human")

			resp, err := clientFn().DoGet("/api/workflows/"+workflowID, nil)
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
				var workflow struct {
					WorkflowID string `json:"workflow_id"`
					Name       string `json:"name"`
					Content    string `json:"content"`
				}
				if json.Unmarshal(data, &workflow) != nil {
					return
				}
				fmt.Fprintf(w, "Workflow ID: %s\n", workflow.WorkflowID)
				fmt.Fprintf(w, "Name: %s\n", workflow.Name)
				fmt.Fprintf(w, "Content:\n%s\n", workflow.Content)
			})
		},
	}

	cmd.Flags().Bool("human", false, "Human-readable output")

	c.Command = cmd
	return c
}

// --- Workflow Update ---

type WorkflowUpdateCmd struct {
	Command *cobra.Command
}

func NewWorkflowUpdateCmd(clientFn func() *Client, out *bytes.Buffer) *WorkflowUpdateCmd {
	c := &WorkflowUpdateCmd{}

	cmd := &cobra.Command{
		Use:   "update <workflow-id>",
		Short: "Update a workflow",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			workflowID := args[0]
			contentPath, _ := cmd.Flags().GetString("content")
			humanMode, _ := cmd.Flags().GetBool("human")

			content, err := os.ReadFile(contentPath)
			if err != nil {
				return fmt.Errorf("read content file: %w", err)
			}

			body := map[string]any{
				"content": string(content),
			}

			jsonBody, err := json.Marshal(body)
			if err != nil {
				return err
			}

			resp, err := clientFn().DoRequest(http.MethodPut, "/api/workflows/"+workflowID, jsonBody)
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
				fmt.Fprintf(w, "Updated workflow %s\n", workflowID)
			})
		},
	}

	cmd.Flags().String("content", "", "Path to workflow content file")
	cmd.Flags().Bool("human", false, "Human-readable output")
	_ = cmd.MarkFlagRequired("content")

	c.Command = cmd
	return c
}

// --- Workflow Delete ---

type WorkflowDeleteCmd struct {
	Command *cobra.Command
}

func NewWorkflowDeleteCmd(clientFn func() *Client, out *bytes.Buffer) *WorkflowDeleteCmd {
	c := &WorkflowDeleteCmd{}

	cmd := &cobra.Command{
		Use:   "delete <workflow-id>",
		Short: "Delete a workflow",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			workflowID := args[0]
			humanMode, _ := cmd.Flags().GetBool("human")

			resp, err := clientFn().DoRequest(http.MethodDelete, "/api/workflows/"+workflowID, nil)
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
				fmt.Fprintf(w, "Deleted workflow %s\n", workflowID)
			})
		},
	}

	cmd.Flags().Bool("human", false, "Human-readable output")

	c.Command = cmd
	return c
}

// --- Workflow Command Group ---

type WorkflowCmd struct {
	Command *cobra.Command
}

func NewWorkflowCmd(clientFn func() *Client, out *bytes.Buffer) *WorkflowCmd {
	c := &WorkflowCmd{}

	cmd := &cobra.Command{
		Use:   "workflow",
		Short: "Manage workflows",
	}

	cmd.AddCommand(NewWorkflowCreateCmd(clientFn, out).Command)
	cmd.AddCommand(NewWorkflowListCmd(clientFn, out).Command)
	cmd.AddCommand(NewWorkflowShowCmd(clientFn, out).Command)
	cmd.AddCommand(NewWorkflowUpdateCmd(clientFn, out).Command)
	cmd.AddCommand(NewWorkflowDeleteCmd(clientFn, out).Command)

	c.Command = cmd
	return c
}
