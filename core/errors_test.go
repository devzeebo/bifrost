package core

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

// --- Tests ---

func TestConcurrencyError(t *testing.T) {
	t.Run("implements error interface with descriptive message", func(t *testing.T) {
		tc := newErrorTestContext(t)

		// Given
		tc.a_concurrency_error()

		// When
		tc.error_message_is_retrieved()

		// Then
		tc.message_contains("stream-1")
		tc.message_contains("expected version 3")
		tc.message_contains("actual version 5")
	})

	t.Run("can be unwrapped with errors.As from a wrapped error", func(t *testing.T) {
		tc := newErrorTestContext(t)

		// Given
		tc.a_wrapped_concurrency_error()

		// When
		tc.errors_as_concurrency_error()

		// Then
		tc.concurrency_error_was_found()
		tc.concurrency_error_has_stream_id("stream-1")
		tc.concurrency_error_has_expected_version(3)
		tc.concurrency_error_has_actual_version(5)
	})
}

func TestNotFoundError(t *testing.T) {
	t.Run("implements error interface with descriptive message", func(t *testing.T) {
		tc := newErrorTestContext(t)

		// Given
		tc.a_not_found_error()

		// When
		tc.error_message_is_retrieved()

		// Then
		tc.message_contains("User")
		tc.message_contains("user-42")
		tc.message_contains("not found")
	})

	t.Run("can be unwrapped with errors.As from a wrapped error", func(t *testing.T) {
		tc := newErrorTestContext(t)

		// Given
		tc.a_wrapped_not_found_error()

		// When
		tc.errors_as_not_found_error()

		// Then
		tc.not_found_error_was_found()
		tc.not_found_error_has_entity("User")
		tc.not_found_error_has_id("user-42")
	})
}

// --- Test Context ---

type errorTestContext struct {
	t *testing.T

	err     error
	message string

	foundConcurrencyError *ConcurrencyError
	concurrencyErrorFound bool

	foundNotFoundError *NotFoundError
	notFoundErrorFound bool
}

func newErrorTestContext(t *testing.T) *errorTestContext {
	t.Helper()
	return &errorTestContext{t: t}
}

// --- Given ---

func (tc *errorTestContext) a_concurrency_error() {
	tc.t.Helper()
	tc.err = &ConcurrencyError{
		StreamID:        "stream-1",
		ExpectedVersion: 3,
		ActualVersion:   5,
	}
}

func (tc *errorTestContext) a_wrapped_concurrency_error() {
	tc.t.Helper()
	tc.a_concurrency_error()
	tc.err = fmt.Errorf("append failed: %w", tc.err)
}

func (tc *errorTestContext) a_not_found_error() {
	tc.t.Helper()
	tc.err = &NotFoundError{
		Entity: "User",
		ID:     "user-42",
	}
}

func (tc *errorTestContext) a_wrapped_not_found_error() {
	tc.t.Helper()
	tc.a_not_found_error()
	tc.err = fmt.Errorf("lookup failed: %w", tc.err)
}

// --- When ---

func (tc *errorTestContext) error_message_is_retrieved() {
	tc.t.Helper()
	tc.message = tc.err.Error()
}

func (tc *errorTestContext) errors_as_concurrency_error() {
	tc.t.Helper()
	var target *ConcurrencyError
	tc.concurrencyErrorFound = errors.As(tc.err, &target)
	tc.foundConcurrencyError = target
}

func (tc *errorTestContext) errors_as_not_found_error() {
	tc.t.Helper()
	var target *NotFoundError
	tc.notFoundErrorFound = errors.As(tc.err, &target)
	tc.foundNotFoundError = target
}

// --- Then ---

func (tc *errorTestContext) message_contains(substring string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.message, substring)
}

func (tc *errorTestContext) concurrency_error_was_found() {
	tc.t.Helper()
	assert.True(tc.t, tc.concurrencyErrorFound, "expected errors.As to find ConcurrencyError")
}

func (tc *errorTestContext) concurrency_error_has_stream_id(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.foundConcurrencyError.StreamID)
}

func (tc *errorTestContext) concurrency_error_has_expected_version(expected int) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.foundConcurrencyError.ExpectedVersion)
}

func (tc *errorTestContext) concurrency_error_has_actual_version(expected int) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.foundConcurrencyError.ActualVersion)
}

func (tc *errorTestContext) not_found_error_was_found() {
	tc.t.Helper()
	assert.True(tc.t, tc.notFoundErrorFound, "expected errors.As to find NotFoundError")
}

func (tc *errorTestContext) not_found_error_has_entity(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.foundNotFoundError.Entity)
}

func (tc *errorTestContext) not_found_error_has_id(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.foundNotFoundError.ID)
}
