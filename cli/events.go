package cli

import (
	"bytes"

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

			respBody, err := clientFn().DoGetWithParams("/events", map[string]string{"runeId": id})
			if err != nil {
				return err
			}

			_, err = out.Write(respBody)
			return err
		},
	}

	c.Command = cmd
	return c
}
