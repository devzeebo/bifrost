package projectors

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

type RuneSummary struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Status    string    `json:"status"`
	Priority  int       `json:"priority"`
	Claimant  string    `json:"claimant,omitempty"`
	ParentID  string    `json:"parent_id,omitempty"`
	Branch    string    `json:"branch,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type RuneListProjector struct{}

func NewRuneListProjector() *RuneListProjector {
	return &RuneListProjector{}
}

func (p *RuneListProjector) Name() string {
	return "rune_list"
}

func (p *RuneListProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventRuneCreated:
		return p.handleCreated(ctx, event, store)
	case domain.EventRuneUpdated:
		return p.handleUpdated(ctx, event, store)
	case domain.EventRuneClaimed:
		return p.handleClaimed(ctx, event, store)
	case domain.EventRuneFulfilled:
		return p.handleFulfilled(ctx, event, store)
	case domain.EventRuneSealed:
		return p.handleSealed(ctx, event, store)
	}
	return nil
}

func (p *RuneListProjector) handleCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	summary := RuneSummary{
		ID:        data.ID,
		Title:     data.Title,
		Status:    "open",
		Priority:  data.Priority,
		ParentID:  data.ParentID,
		Branch:    data.Branch,
		CreatedAt: event.Timestamp,
		UpdatedAt: event.Timestamp,
	}
	return store.Put(ctx, event.RealmID, "rune_list", data.ID, summary)
}

func (p *RuneListProjector) handleUpdated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneUpdated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var summary RuneSummary
	if err := store.Get(ctx, event.RealmID, "rune_list", data.ID, &summary); err != nil {
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
	return store.Put(ctx, event.RealmID, "rune_list", data.ID, summary)
}

func (p *RuneListProjector) handleClaimed(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneClaimed
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var summary RuneSummary
	if err := store.Get(ctx, event.RealmID, "rune_list", data.ID, &summary); err != nil {
		return err
	}
	summary.Status = "claimed"
	summary.Claimant = data.Claimant
	summary.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_list", data.ID, summary)
}

func (p *RuneListProjector) handleFulfilled(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneFulfilled
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var summary RuneSummary
	if err := store.Get(ctx, event.RealmID, "rune_list", data.ID, &summary); err != nil {
		return err
	}
	summary.Status = "fulfilled"
	summary.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_list", data.ID, summary)
}

func (p *RuneListProjector) handleSealed(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneSealed
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var summary RuneSummary
	if err := store.Get(ctx, event.RealmID, "rune_list", data.ID, &summary); err != nil {
		return err
	}
	summary.Status = "sealed"
	summary.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_list", data.ID, summary)
}

func isNotFoundError(err error) bool {
	var nfe *core.NotFoundError
	return errors.As(err, &nfe)
}
