package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"

	"github.com/spf13/cobra"
)

type StateCmd struct {
	Command *cobra.Command
}

func NewStateCmd(clientFn func() *Client, out *bytes.Buffer) *StateCmd {
	c := &StateCmd{}

	cmd := &cobra.Command{
		Use:   "state",
		Short: "Manage rune state",
		Long: `Manage rune state (schemaless JSON blob).

Subcommands:
		  get   - Get current state
		  set   - Apply JSON Merge Patch
		  clear - Clear all state`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			// Default to showing help if no subcommand
			return cmd.Help()
		},
	}

	cmd.AddCommand(c.newGetCmd(clientFn, out))
	cmd.AddCommand(c.newSetCmd(clientFn, out))
	cmd.AddCommand(c.newClearCmd(clientFn, out))

	c.Command = cmd
	return c
}

func (c *StateCmd) newGetCmd(clientFn func() *Client, out *bytes.Buffer) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "get [rune-id]",
		Short: "Get rune state",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			runeID := args[0]
			humanMode, _ := cmd.Flags().GetBool("human")

			respBody, err := clientFn().DoGetWithParams("/rune", map[string]string{"id": runeID})
			if err != nil {
				return err
			}

			return PrintOutput(out, respBody, humanMode, func(w *bytes.Buffer, data []byte) {
				var result map[string]any
				if json.Unmarshal(data, &result) == nil {
					state, ok := result["state"].(map[string]any)
					if !ok || len(state) == 0 {
						fmt.Fprintf(w, "State: (none)\n")
						return
					}
					pretty, _ := json.MarshalIndent(state, "", "  ")
					fmt.Fprintf(w, "State:\n%s\n", string(pretty))
				}
			})
		},
	}
	cmd.Flags().Bool("human", false, "human-readable output")
	return cmd
}

func (c *StateCmd) newSetCmd(clientFn func() *Client, out *bytes.Buffer) *cobra.Command {
	var patchFromStdin bool

	cmd := &cobra.Command{
		Use:   "set [rune-id]",
		Short: "Apply JSON Merge Patch to rune state",
		Long: `Apply a JSON Merge Patch (RFC 7396) to the rune state.

Examples:
		  bf state rune-abc set '{"coverage": 85}'
		  bf state rune-abc set '{"coverage": 92, "tested": true}'
		  echo '{"foo": "bar"}' | bf state rune-abc set --stdin
		  cat <<'EOF' | bf state rune-abc set
		  {"nested": {"value": 123}, "array": [1, 2, 3]}
		  EOF`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			runeID := args[0]
			humanMode, _ := cmd.Flags().GetBool("human")

			var patchJSON string
			if patchFromStdin {
				// Read patch from stdin
				stdinData, err := io.ReadAll(cmd.InOrStdin())
				if err != nil {
					return fmt.Errorf("failed to read stdin: %w", err)
				}
				patchJSON = string(stdinData)
			} else {
				// Read patch from argument
				patchArgs, _ := cmd.Flags().GetStringArray("patch")
				if len(patchArgs) == 0 {
					return fmt.Errorf("patch JSON required via --patch or --stdin")
				}
				// Concatenate multiple --patch arguments
				patchJSON = patchArgs[0]
				for i := 1; i < len(patchArgs); i++ {
					patchJSON += patchArgs[i]
				}
			}

			// Validate JSON
			var patch map[string]any
			if err := json.Unmarshal([]byte(patchJSON), &patch); err != nil {
				return fmt.Errorf("invalid patch JSON: %w", err)
			}
			if patch == nil {
				return fmt.Errorf("patch must be a JSON object, not null")
			}

			body := map[string]any{
				"rune_id": runeID,
				"patch":   patchJSON,
			}

			_, err := clientFn().DoPost("/update-rune-state", body)
			if err != nil {
				return err
			}

			if humanMode {
				fmt.Fprintf(out, "Rune %s state updated\n", runeID)
			}

			return nil
		},
	}

	cmd.Flags().StringArray("patch", nil, "JSON Merge Patch (repeatable)")
	cmd.Flags().BoolVar(&patchFromStdin, "stdin", false, "Read patch from stdin")
	cmd.Flags().Bool("human", false, "human-readable output")

	return cmd
}

func (c *StateCmd) newClearCmd(clientFn func() *Client, out *bytes.Buffer) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "clear [rune-id]",
		Short: "Clear all rune state",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			runeID := args[0]
			humanMode, _ := cmd.Flags().GetBool("human")

			body := map[string]any{
				"rune_id": runeID,
			}

			_, err := clientFn().DoPost("/clear-rune-state", body)
			if err != nil {
				return err
			}

			if humanMode {
				fmt.Fprintf(out, "Rune %s state cleared\n", runeID)
			}

			return nil
		},
	}
	cmd.Flags().Bool("human", false, "human-readable output")
	return cmd
}
