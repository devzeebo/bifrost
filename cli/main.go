package cli

import (
	"bytes"
	"fmt"
	"os"
)

func Run() {
	root := NewRootCmd()
	out := &bytes.Buffer{}

	RegisterRuneCommands(root, out)

	if err := root.Command.Execute(); err != nil {
		os.Exit(1)
	}

	if out.Len() > 0 {
		fmt.Print(out.String())
	}
}
