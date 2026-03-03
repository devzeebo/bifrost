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

// --- Skill Create ---

type SkillCreateCmd struct {
	Command *cobra.Command
}

func NewSkillCreateCmd(clientFn func() *Client, out *bytes.Buffer) *SkillCreateCmd {
	c := &SkillCreateCmd{}

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new skill",
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

			resp, err := clientFn().DoPost("/api/skills", jsonBody)
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
					SkillID string `json:"skill_id"`
					Name    string `json:"name"`
				}
				if json.Unmarshal(data, &result) != nil {
					return
				}
				fmt.Fprintf(w, "Created skill %s: %s\n", result.SkillID, result.Name)
			})
		},
	}

	cmd.Flags().String("name", "", "Skill name")
	cmd.Flags().String("content", "", "Path to skill content file")
	cmd.Flags().Bool("human", false, "Human-readable output")
	_ = cmd.MarkFlagRequired("name")
	_ = cmd.MarkFlagRequired("content")

	c.Command = cmd
	return c
}

// --- Skill List ---

type SkillListCmd struct {
	Command *cobra.Command
}

func NewSkillListCmd(clientFn func() *Client, out *bytes.Buffer) *SkillListCmd {
	c := &SkillListCmd{}

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List all skills",
		RunE: func(cmd *cobra.Command, args []string) error {
			humanMode, _ := cmd.Flags().GetBool("human")

			resp, err := clientFn().DoGet("/api/skills", nil)
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
				var skills []map[string]any
				if json.Unmarshal(data, &skills) != nil {
					return
				}
				tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
				fmt.Fprintf(tw, "ID\tName\n")
				for _, s := range skills {
					id, _ := s["skill_id"].(string)
					name, _ := s["name"].(string)
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

// --- Skill Show ---

type SkillShowCmd struct {
	Command *cobra.Command
}

func NewSkillShowCmd(clientFn func() *Client, out *bytes.Buffer) *SkillShowCmd {
	c := &SkillShowCmd{}

	cmd := &cobra.Command{
		Use:   "show <skill-id>",
		Short: "Show skill details",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			skillID := args[0]
			humanMode, _ := cmd.Flags().GetBool("human")

			resp, err := clientFn().DoGet("/api/skills/"+skillID, nil)
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
				var skill struct {
					SkillID string `json:"skill_id"`
					Name    string `json:"name"`
					Content string `json:"content"`
				}
				if json.Unmarshal(data, &skill) != nil {
					return
				}
				fmt.Fprintf(w, "Skill ID: %s\n", skill.SkillID)
				fmt.Fprintf(w, "Name: %s\n", skill.Name)
				fmt.Fprintf(w, "Content:\n%s\n", skill.Content)
			})
		},
	}

	cmd.Flags().Bool("human", false, "Human-readable output")

	c.Command = cmd
	return c
}

// --- Skill Update ---

type SkillUpdateCmd struct {
	Command *cobra.Command
}

func NewSkillUpdateCmd(clientFn func() *Client, out *bytes.Buffer) *SkillUpdateCmd {
	c := &SkillUpdateCmd{}

	cmd := &cobra.Command{
		Use:   "update <skill-id>",
		Short: "Update a skill",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			skillID := args[0]
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

			resp, err := clientFn().DoRequest(http.MethodPut, "/api/skills/"+skillID, jsonBody)
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
				fmt.Fprintf(w, "Updated skill %s\n", skillID)
			})
		},
	}

	cmd.Flags().String("content", "", "Path to skill content file")
	cmd.Flags().Bool("human", false, "Human-readable output")
	_ = cmd.MarkFlagRequired("content")

	c.Command = cmd
	return c
}

// --- Skill Delete ---

type SkillDeleteCmd struct {
	Command *cobra.Command
}

func NewSkillDeleteCmd(clientFn func() *Client, out *bytes.Buffer) *SkillDeleteCmd {
	c := &SkillDeleteCmd{}

	cmd := &cobra.Command{
		Use:   "delete <skill-id>",
		Short: "Delete a skill",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			skillID := args[0]
			humanMode, _ := cmd.Flags().GetBool("human")

			resp, err := clientFn().DoRequest(http.MethodDelete, "/api/skills/"+skillID, nil)
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
				fmt.Fprintf(w, "Deleted skill %s\n", skillID)
			})
		},
	}

	cmd.Flags().Bool("human", false, "Human-readable output")

	c.Command = cmd
	return c
}

// --- Skill Command Group ---

type SkillCmd struct {
	Command *cobra.Command
}

func NewSkillCmd(clientFn func() *Client, out *bytes.Buffer) *SkillCmd {
	c := &SkillCmd{}

	cmd := &cobra.Command{
		Use:   "skill",
		Short: "Manage skills",
	}

	cmd.AddCommand(NewSkillCreateCmd(clientFn, out).Command)
	cmd.AddCommand(NewSkillListCmd(clientFn, out).Command)
	cmd.AddCommand(NewSkillShowCmd(clientFn, out).Command)
	cmd.AddCommand(NewSkillUpdateCmd(clientFn, out).Command)
	cmd.AddCommand(NewSkillDeleteCmd(clientFn, out).Command)

	c.Command = cmd
	return c
}
