package projectors

import (
	"context"
	"encoding/json"
	"time"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

type DependencyRef struct {
	TargetID     string `json:"target_id"`
	Relationship string `json:"relationship"`
}

type NoteEntry struct {
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"created_at"`
}

type ACEntry struct {
	ID          string `json:"id"`
	Scenario    string `json:"scenario"`
	Description string `json:"description"`
}

type RuneDetail struct {
	ID                 string          `json:"id"`
	Title              string          `json:"title"`
	Description        string          `json:"description,omitempty"`
	Status             string          `json:"status"`
	Priority           int             `json:"priority"`
	Claimant           string          `json:"claimant,omitempty"`
	ParentID           string          `json:"parent_id,omitempty"`
	Branch             string          `json:"branch,omitempty"`
	Tags               []string        `json:"tags"`
	Type               string          `json:"type,omitempty"`
	Dependencies       []DependencyRef `json:"dependencies"`
	Notes              []NoteEntry     `json:"notes"`
	RetroItems         []RetroEntry    `json:"retro_items"`
	AcceptanceCriteria []ACEntry       `json:"acceptance_criteria"`
	CreatedAt          time.Time       `json:"created_at"`
	UpdatedAt          time.Time       `json:"updated_at"`
}

type RuneDetailProjector struct{}

func NewRuneDetailProjector() *RuneDetailProjector {
	return &RuneDetailProjector{}
}

func (p *RuneDetailProjector) Name() string {
	return "rune_detail"
}

func (p *RuneDetailProjector) TableName() string {
	return "rune_detail"
}

func (p *RuneDetailProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
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
	case domain.EventDependencyAdded:
		return p.handleDependencyAdded(ctx, event, store)
	case domain.EventDependencyRemoved:
		return p.handleDependencyRemoved(ctx, event, store)
	case domain.EventRuneNoted:
		return p.handleNoted(ctx, event, store)
	case domain.EventRuneRetroed:
		return p.handleRetroed(ctx, event, store)
	case domain.EventRuneShattered:
		return p.handleShattered(ctx, event, store)
	case domain.EventRuneACAdded:
		return p.handleACAdded(ctx, event, store)
	case domain.EventRuneACUpdated:
		return p.handleACUpdated(ctx, event, store)
	case domain.EventRuneACRemoved:
		return p.handleACRemoved(ctx, event, store)
	}
	return nil
}

func (p *RuneDetailProjector) handleCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	detail := RuneDetail{
		ID:                 data.ID,
		Title:              data.Title,
		Description:        data.Description,
		Status:             "draft",
		Priority:           data.Priority,
		ParentID:           data.ParentID,
		Branch:             data.Branch,
		Tags:               normalizeTags(data.Tags),
		Type:               data.Type,
		Dependencies:       []DependencyRef{},
		Notes:              []NoteEntry{},
		RetroItems:         []RetroEntry{},
		AcceptanceCriteria: []ACEntry{},
		CreatedAt:          event.Timestamp,
		UpdatedAt:          event.Timestamp,
	}
	return store.Put(ctx, event.RealmID, "rune_detail", data.ID, detail)
}

func (p *RuneDetailProjector) handleForged(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneForged
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var detail RuneDetail
	if err := store.Get(ctx, event.RealmID, "rune_detail", data.ID, &detail); err != nil {
		return err
	}
	detail.Status = "open"
	detail.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_detail", data.ID, detail)
}

func (p *RuneDetailProjector) handleUpdated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneUpdated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var detail RuneDetail
	if err := store.Get(ctx, event.RealmID, "rune_detail", data.ID, &detail); err != nil {
		return err
	}
	if data.Title != nil {
		detail.Title = *data.Title
	}
	if data.Description != nil {
		detail.Description = *data.Description
	}
	if data.Priority != nil {
		detail.Priority = *data.Priority
	}
	if data.Branch != nil {
		detail.Branch = *data.Branch
	}
	detail.Tags = applyTagMutations(detail.Tags, data.Tags, data.AddTags, data.RemoveTags)
	detail.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_detail", data.ID, detail)
}

func (p *RuneDetailProjector) handleClaimed(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneClaimed
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var detail RuneDetail
	if err := store.Get(ctx, event.RealmID, "rune_detail", data.ID, &detail); err != nil {
		return err
	}
	detail.Status = "claimed"
	detail.Claimant = data.Claimant
	detail.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_detail", data.ID, detail)
}

func (p *RuneDetailProjector) handleFulfilled(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneFulfilled
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var detail RuneDetail
	if err := store.Get(ctx, event.RealmID, "rune_detail", data.ID, &detail); err != nil {
		return err
	}
	detail.Status = "fulfilled"
	detail.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_detail", data.ID, detail)
}

func (p *RuneDetailProjector) handleSealed(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneSealed
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var detail RuneDetail
	if err := store.Get(ctx, event.RealmID, "rune_detail", data.ID, &detail); err != nil {
		return err
	}
	detail.Status = "sealed"
	detail.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_detail", data.ID, detail)
}

func (p *RuneDetailProjector) handleUnclaimed(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneUnclaimed
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var detail RuneDetail
	if err := store.Get(ctx, event.RealmID, "rune_detail", data.ID, &detail); err != nil {
		return err
	}
	detail.Status = "open"
	detail.Claimant = ""
	detail.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_detail", data.ID, detail)
}

func (p *RuneDetailProjector) handleDependencyAdded(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.DependencyAdded
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var detail RuneDetail
	if err := store.Get(ctx, event.RealmID, "rune_detail", data.RuneID, &detail); err != nil {
		return err
	}
	// Check for duplicate for idempotency
	for _, dep := range detail.Dependencies {
		if dep.TargetID == data.TargetID && dep.Relationship == data.Relationship {
			return nil // Already exists, idempotent
		}
	}
	detail.Dependencies = append(detail.Dependencies, DependencyRef{
		TargetID:     data.TargetID,
		Relationship: data.Relationship,
	})
	detail.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_detail", data.RuneID, detail)
}

func (p *RuneDetailProjector) handleDependencyRemoved(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.DependencyRemoved
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var detail RuneDetail
	if err := store.Get(ctx, event.RealmID, "rune_detail", data.RuneID, &detail); err != nil {
		return err
	}
	filtered := make([]DependencyRef, 0, len(detail.Dependencies))
	for _, dep := range detail.Dependencies {
		if dep.TargetID != data.TargetID || dep.Relationship != data.Relationship {
			filtered = append(filtered, dep)
		}
	}
	detail.Dependencies = filtered
	detail.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_detail", data.RuneID, detail)
}

func (p *RuneDetailProjector) handleShattered(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneShattered
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	return store.Delete(ctx, event.RealmID, "rune_detail", data.ID)
}

func (p *RuneDetailProjector) handleNoted(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneNoted
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var detail RuneDetail
	if err := store.Get(ctx, event.RealmID, "rune_detail", data.RuneID, &detail); err != nil {
		return err
	}
	// Check for duplicate for idempotency (notes are unique by text + timestamp)
	for _, note := range detail.Notes {
		if note.Text == data.Text && note.CreatedAt.Equal(event.Timestamp) {
			return nil // Already exists, idempotent
		}
	}
	detail.Notes = append(detail.Notes, NoteEntry{
		Text:      data.Text,
		CreatedAt: event.Timestamp,
	})
	detail.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_detail", data.RuneID, detail)
}

func (p *RuneDetailProjector) handleRetroed(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneRetroed
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var detail RuneDetail
	if err := store.Get(ctx, event.RealmID, "rune_detail", data.RuneID, &detail); err != nil {
		return err
	}
	// Check for duplicate for idempotency (retro items are unique by text + timestamp)
	for _, item := range detail.RetroItems {
		if item.Text == data.Text && item.CreatedAt.Equal(event.Timestamp) {
			return nil // Already exists, idempotent
		}
	}
	detail.RetroItems = append(detail.RetroItems, RetroEntry{
		Text:      data.Text,
		CreatedAt: event.Timestamp,
	})
	detail.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_detail", data.RuneID, detail)
}

func (p *RuneDetailProjector) handleACAdded(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneACAdded
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var detail RuneDetail
	if err := store.Get(ctx, event.RealmID, "rune_detail", data.RuneID, &detail); err != nil {
		return err
	}
	// Check for duplicate for idempotency (AC items are unique by ID + timestamp)
	for _, ac := range detail.AcceptanceCriteria {
		if ac.ID == data.ID && ac.Scenario == data.Scenario && ac.Description == data.Description {
			return nil // Already exists, idempotent
		}
	}
	detail.AcceptanceCriteria = append(detail.AcceptanceCriteria, ACEntry{
		ID:          data.ID,
		Scenario:    data.Scenario,
		Description: data.Description,
	})
	detail.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_detail", data.RuneID, detail)
}

func (p *RuneDetailProjector) handleACUpdated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneACUpdated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var detail RuneDetail
	if err := store.Get(ctx, event.RealmID, "rune_detail", data.RuneID, &detail); err != nil {
		return err
	}
	// Find and update the AC entry
	for i, ac := range detail.AcceptanceCriteria {
		if ac.ID == data.ID {
			detail.AcceptanceCriteria[i].Scenario = data.Scenario
			detail.AcceptanceCriteria[i].Description = data.Description
			break
		}
	}
	detail.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_detail", data.RuneID, detail)
}

func (p *RuneDetailProjector) handleACRemoved(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneACRemoved
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var detail RuneDetail
	if err := store.Get(ctx, event.RealmID, "rune_detail", data.RuneID, &detail); err != nil {
		return err
	}
	// Remove the AC entry by ID
	filtered := make([]ACEntry, 0, len(detail.AcceptanceCriteria))
	for _, ac := range detail.AcceptanceCriteria {
		if ac.ID != data.ID {
			filtered = append(filtered, ac)
		}
	}
	detail.AcceptanceCriteria = filtered
	detail.UpdatedAt = event.Timestamp
	return store.Put(ctx, event.RealmID, "rune_detail", data.RuneID, detail)
}
