package core

import "fmt"

// ConcurrencyError is returned when Append detects a version mismatch
type ConcurrencyError struct {
	StreamID        string
	ExpectedVersion int
	ActualVersion   int
}

func (e *ConcurrencyError) Error() string {
	return fmt.Sprintf(
		"concurrency conflict on stream %q: expected version %d, actual version %d",
		e.StreamID, e.ExpectedVersion, e.ActualVersion,
	)
}

// NotFoundError is returned when a requested entity does not exist
type NotFoundError struct {
	Entity string
	ID     string
}

func (e *NotFoundError) Error() string {
	return fmt.Sprintf("%s %q not found", e.Entity, e.ID)
}
