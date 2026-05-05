package projectors

import (
	"context"
	"encoding/json"
	"time"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

type RetroEntry struct {
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"created_at"`
}

type RuneRetro struct {
	ID          string       `json:"id"`
	Title       string       `json:"title"`
	Description string       `json:"description,omitempty"`
	Status      string       `json:"status"`
	ParentID    string       `json:"parent_id,omitempty"`
	RetroItems  []RetroEntry `json:"retro_items"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

type RuneRetroProjector struct{}

func NewRuneRetroProjector() *RuneRetroProjector {
	return &RuneRetroProjector{}
}

func (p *RuneRetroProjector) Name() string {
	return "rune_retro"
}

func (p *RuneRetroProjector) TableName() string {
	return "rune_retro"
}

func (p *RuneRetroProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventRuneCreated:
		return p.handleCreated(ctx, event, store)
	case domain.EventRuneUpdated:
		return p.handleUpdated(ctx, event, store)
	case domain.EventRuneForged:
		return p.handleStatusChange(ctx, event, store, "open", func(e core.Event) string {
			var data domain.RuneForged
			_ = json.Unmarshal(e.Data, &data)
			return data.ID
		})
	case domain.EventRuneClaimed:
		return p.handleStatusChange(ctx, event, store, "claimed", func(e core.Event) string {
			var data domain.RuneClaimed
			_ = json.Unmarshal(e.Data, &data)
			return data.ID
		})
	case domain.EventRuneUnclaimed:
		return p.handleStatusChange(ctx, event, store, "open", func(e core.Event) string {
			var data domain.RuneUnclaimed
			_ = json.Unmarshal(e.Data, &data)
			return data.ID
		})
	case domain.EventRuneFulfilled:
		return p.handleStatusChange(ctx, event, store, "fulfilled", func(e core.Event) string {
			var data domain.RuneFulfilled
			_ = json.Unmarshal(e.Data, &data)
			return data.ID
		})
	case domain.EventRuneSealed:
		return p.handleStatusChange(ctx, event, store, "sealed", func(e core.Event) string {
			var data domain.RuneSealed
			_ = json.Unmarshal(e.Data, &data)
			return data.ID
		})
	case domain.EventRuneShattered:
		// Update status but do NOT delete — retro items must survive shatter.
		return p.handleStatusChange(ctx, event, store, "shattered", func(e core.Event) string {
			var data domain.RuneShattered
			_ = json.Unmarshal(e.Data, &data)
			return data.ID
		})
	case domain.EventRuneRetroed:
		return p.handleRetroed(ctx, event, store)
	}
	return nil
}

func (p *RuneRetroProjector) handleCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	retro := RuneRetro{
		ID:          data.ID,
		Title:       data.Title,
		Description: data.Description,
		Status:      "draft",
		ParentID:    data.ParentID,
		RetroItems:  []RetroEntry{},
		CreatedAt:   event.Timestamp,
		UpdatedAt:   event.Timestamp,
	}
	return store.Put(ctx, event.RealmID, "rune_retro", data.ID, retro)
}

func (p *RuneRetroProjector) handleUpdated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneUpdated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var retro RuneRetro
	if err := store.Get(ctx, event.RealmID, "rune_retro", data.ID, &retro); err != nil {
		return err
	}
	if data.Title != nil {
		retro.Title = *data.Title
	}
	if data.Description != nil {
		retro.Description = *data.Description
	}
	retro.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_retro", data.ID, retro)
}

func (p *RuneRetroProjector) handleStatusChange(ctx context.Context, event core.Event, store core.ProjectionStore, status string, getID func(core.Event) string) error {
	id := getID(event)
	var retro RuneRetro
	if err := store.Get(ctx, event.RealmID, "rune_retro", id, &retro); err != nil {
		return err
	}
	retro.Status = status
	retro.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_retro", id, retro)
}

func (p *RuneRetroProjector) handleRetroed(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneRetroed
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var retro RuneRetro
	if err := store.Get(ctx, event.RealmID, "rune_retro", data.RuneID, &retro); err != nil {
		return err
	}
	// Idempotency: skip if same text + timestamp already exists.
	for _, item := range retro.RetroItems {
		if item.Text == data.Text && item.CreatedAt.Equal(event.Timestamp) {
			return nil
		}
	}
	retro.RetroItems = append(retro.RetroItems, RetroEntry{
		Text:      data.Text,
		CreatedAt: event.Timestamp,
	})
	retro.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_retro", data.RuneID, retro)
}
