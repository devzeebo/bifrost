package cli

import "bytes"

func RegisterRuneCommands(root *RootCmd, out *bytes.Buffer) {
	clientFn := func() *Client { return root.Client }

	root.Command.AddCommand(NewCreateCmd(clientFn, out).Command)
	root.Command.AddCommand(NewShowCmd(clientFn, out).Command)
	root.Command.AddCommand(NewListCmd(clientFn, out).Command)
	root.Command.AddCommand(NewReadyCmd(clientFn, out).Command)
	root.Command.AddCommand(NewClaimCmd(clientFn, out).Command)
	root.Command.AddCommand(NewFulfillCmd(clientFn, out).Command)
	root.Command.AddCommand(NewSealCmd(clientFn, out).Command)
	root.Command.AddCommand(NewForgeCmd(clientFn, out).Command)
	root.Command.AddCommand(NewUpdateCmd(clientFn, out).Command)
	root.Command.AddCommand(NewNoteCmd(clientFn, out).Command)
	root.Command.AddCommand(NewEventsCmd(clientFn, out).Command)
}
