package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"

	"github.com/spf13/cobra"
)

type EventsCmd struct {
	Command *cobra.Command
}

func NewEventsCmd(clientFn func() *Client, out *bytes.Buffer) *EventsCmd {
	c := &EventsCmd{}

	cmd := &cobra.Command{
		Use:   "events [id]",
		Short: "Show raw event stream for a rune",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]

			resp, err := clientFn().DoGet("/events", map[string]string{"runeId": id})
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

			_, err = out.Write(respBody)
			return err
		},
	}

	c.Command = cmd
	return c
}
