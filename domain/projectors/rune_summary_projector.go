package projectors

import (
	"context"
	"encoding/json"
	"time"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

// RuneSummary represents a projected view of a rune for list queries.
type RuneSummary struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Status    string    `json:"status"`
	Priority  int       `json:"priority"`
	Claimant  string    `json:"claimant,omitempty"`
	ParentID  string    `json:"parent_id,omitempty"`
	Branch    string    `json:"branch,omitempty"`
	Type      string    `json:"type,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// RuneSummaryProjector projects rune events into a summary table.
type RuneSummaryProjector struct{}

// NewRuneSummaryProjector creates a new RuneSummaryProjector.
func NewRuneSummaryProjector() *RuneSummaryProjector {
	return &RuneSummaryProjector{}
}

// Name returns the projector name.
func (p *RuneSummaryProjector) Name() string {
	return "rune_summary"
}

// TableName returns the projection table name.
func (p *RuneSummaryProjector) TableName() string {
	return "rune_summary"
}

// Handle processes events and updates the projection.
func (p *RuneSummaryProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventRuneCreated:
		return p.handleCreated(ctx, event, store)
	case domain.EventRuneUpdated:
		return p.handleUpdated(ctx, event, store)
	case domain.EventRuneClaimed:
		return p.handleClaimed(ctx, event, store)
	case domain.EventRuneFulfilled:
		return p.handleFulfilled(ctx, event, store)
	case domain.EventRuneForged:
		return p.handleForged(ctx, event, store)
	case domain.EventRuneSealed:
		return p.handleSealed(ctx, event, store)
	case domain.EventRuneUnclaimed:
		return p.handleUnclaimed(ctx, event, store)
	case domain.EventRuneShattered:
		return p.handleShattered(ctx, event, store)
	}
	return nil
}

func (p *RuneSummaryProjector) handleCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	summary := RuneSummary{
		ID:        data.ID,
		Title:     data.Title,
		Status:    "draft",
		Priority:  data.Priority,
		ParentID:  data.ParentID,
		Branch:    data.Branch,
		Type:      data.Type,
		CreatedAt: event.Timestamp,
		UpdatedAt: event.Timestamp,
	}
	return store.Put(ctx, event.RealmID, "rune_summary", data.ID, summary)
}

func (p *RuneSummaryProjector) handleForged(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneForged
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var summary RuneSummary
	if err := store.Get(ctx, event.RealmID, "rune_summary", data.ID, &summary); err != nil {
		return err
	}
	summary.Status = "open"
	summary.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_summary", data.ID, summary)
}

func (p *RuneSummaryProjector) handleUpdated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneUpdated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var summary RuneSummary
	if err := store.Get(ctx, event.RealmID, "rune_summary", data.ID, &summary); err != nil {
		return err
	}
	if data.Title != nil {
		summary.Title = *data.Title
	}
	if data.Priority != nil {
		summary.Priority = *data.Priority
	}
	if data.Branch != nil {
		summary.Branch = *data.Branch
	}
	summary.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_summary", data.ID, summary)
}

func (p *RuneSummaryProjector) handleClaimed(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneClaimed
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var summary RuneSummary
	if err := store.Get(ctx, event.RealmID, "rune_summary", data.ID, &summary); err != nil {
		return err
	}
	summary.Status = "claimed"
	summary.Claimant = data.Claimant
	summary.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_summary", data.ID, summary)
}

func (p *RuneSummaryProjector) handleFulfilled(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneFulfilled
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var summary RuneSummary
	if err := store.Get(ctx, event.RealmID, "rune_summary", data.ID, &summary); err != nil {
		return err
	}
	summary.Status = "fulfilled"
	summary.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_summary", data.ID, summary)
}

func (p *RuneSummaryProjector) handleSealed(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneSealed
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var summary RuneSummary
	if err := store.Get(ctx, event.RealmID, "rune_summary", data.ID, &summary); err != nil {
		return err
	}
	summary.Status = "sealed"
	summary.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_summary", data.ID, summary)
}

func (p *RuneSummaryProjector) handleUnclaimed(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneUnclaimed
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var summary RuneSummary
	if err := store.Get(ctx, event.RealmID, "rune_summary", data.ID, &summary); err != nil {
		return err
	}
	summary.Status = "open"
	summary.Claimant = ""
	summary.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_summary", data.ID, summary)
}

func (p *RuneSummaryProjector) handleShattered(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneShattered
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	return store.Delete(ctx, event.RealmID, "rune_summary", data.ID)
}
