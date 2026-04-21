package cli

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestPrintOutput(t *testing.T) {
	t.Run("prints JSON by default", func(t *testing.T) {
		tc := newOutputTestContext(t)

		// Given
		tc.json_mode()
		tc.data_is([]byte(`{"id":"123","name":"test"}`))

		// When
		tc.print_output()

		// Then
		tc.output_has_no_error()
		tc.output_contains(`{"id":"123","name":"test"}`)
	})

	t.Run("calls human formatter when human mode is set", func(t *testing.T) {
		tc := newOutputTestContext(t)

		// Given
		tc.human_mode()
		tc.data_is([]byte(`{"id":"123","name":"test"}`))
		tc.human_formatter_writes("ID: 123\nName: test")

		// When
		tc.print_output()

		// Then
		tc.output_has_no_error()
		tc.output_contains("ID: 123")
		tc.output_contains("Name: test")
	})
}

// --- Test Context ---

type outputTestContext struct {
	t *testing.T

	data           []byte
	humanMode      bool
	humanFormatter func(w *bytes.Buffer, data []byte)
	buf            *bytes.Buffer
	err            error
}

func newOutputTestContext(t *testing.T) *outputTestContext {
	t.Helper()
	return &outputTestContext{
		t:   t,
		buf: &bytes.Buffer{},
	}
}

// --- Given ---

func (tc *outputTestContext) json_mode() {
	tc.t.Helper()
	tc.humanMode = false
}

func (tc *outputTestContext) human_mode() {
	tc.t.Helper()
	tc.humanMode = true
}

func (tc *outputTestContext) data_is(data []byte) {
	tc.t.Helper()
	tc.data = data
}

func (tc *outputTestContext) human_formatter_writes(text string) {
	tc.t.Helper()
	tc.humanFormatter = func(w *bytes.Buffer, data []byte) {
		w.WriteString(text)
	}
}

// --- When ---

func (tc *outputTestContext) print_output() {
	tc.t.Helper()
	tc.err = PrintOutput(tc.buf, tc.data, tc.humanMode, tc.humanFormatter)
}

// --- Then ---

func (tc *outputTestContext) output_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *outputTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}
