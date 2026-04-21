package core

import "fmt"

// DependencyExistenceDoc is the document stored for each dependency row.
// Row existence indicates the dependency exists.
type DependencyExistenceDoc struct {
	RuneID       string `json:"rune_id"`
	TargetID     string `json:"target_id"`
	Relationship string `json:"relationship"`
}

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
