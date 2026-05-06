package domain

import (
	"encoding/json"
	"fmt"
)

// MergePatch applies a JSON Merge Patch (RFC 7396) to target.
// Patch is merged into target recursively. Null values in patch delete fields.
// Target is modified in place and returned for convenience.
func MergePatch(target, patch map[string]any) (map[string]any, error) {
	for key, patchValue := range patch {
		if patchValue == nil {
			// Null value deletes the field
			delete(target, key)
			continue
		}

		targetValue, exists := target[key]
		if !exists {
			// New key, just add it
			target[key] = patchValue
			continue
		}

		// Both exist - need to merge recursively if both are objects
		patchObj, patchIsObj := patchValue.(map[string]any)
		targetObj, targetIsObj := targetValue.(map[string]any)

		if patchIsObj && targetIsObj {
			// Recursively merge nested objects
			merged, err := MergePatch(targetObj, patchObj)
			if err != nil {
				return nil, err
			}
			target[key] = merged
		} else {
			// Replace target value with patch value
			target[key] = patchValue
		}
	}
	return target, nil
}

// ParseAndApplyPatch parses a JSON patch string and applies it to target state.
// Returns the updated state and any error.
func ParseAndApplyPatch(currentState json.RawMessage, patchJSON string) (map[string]any, error) {
	// Parse the patch
	var patch map[string]any
	if err := json.Unmarshal([]byte(patchJSON), &patch); err != nil {
		return nil, fmt.Errorf("invalid patch JSON: %w", err)
	}

	// Parse current state
	var target map[string]any
	if len(currentState) > 0 {
		if err := json.Unmarshal(currentState, &target); err != nil {
			return nil, fmt.Errorf("invalid current state: %w", err)
		}
	} else {
		target = make(map[string]any)
	}

	// Apply patch
	result, err := MergePatch(target, patch)
	if err != nil {
		return nil, fmt.Errorf("merge failed: %w", err)
	}

	return result, nil
}

const MaxStateSize = 64 * 1024 // 64 KB

// ValidateStateSize checks if the JSON state is within size limits.
func ValidateStateSize(stateJSON []byte) error {
	if len(stateJSON) > MaxStateSize {
		return fmt.Errorf("state size %d bytes exceeds maximum %d bytes", len(stateJSON), MaxStateSize)
	}
	return nil
}
