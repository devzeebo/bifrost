package cli

import (
	"bytes"
)

func PrintOutput(w *bytes.Buffer, data []byte, humanMode bool, humanFormatter func(w *bytes.Buffer, data []byte)) error {
	if humanMode && humanFormatter != nil {
		humanFormatter(w, data)
		return nil
	}

	_, err := w.Write(data)
	return err
}
