package projectors

import (
	"sort"
	"strings"
)

func normalizeTags(tags []string) []string {
	if len(tags) == 0 {
		return []string{}
	}
	seen := make(map[string]struct{}, len(tags))
	out := make([]string, 0, len(tags))
	for _, tag := range tags {
		normalized := strings.ToLower(strings.TrimSpace(tag))
		if normalized == "" {
			continue
		}
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		out = append(out, normalized)
	}
	sort.Strings(out)
	return out
}

func applyTagMutations(current []string, replacement *[]string, addTags []string, removeTags []string) []string {
	next := normalizeTags(current)
	if replacement != nil {
		next = normalizeTags(*replacement)
	}
	if len(addTags) == 0 && len(removeTags) == 0 {
		return next
	}
	set := make(map[string]struct{}, len(next))
	for _, tag := range next {
		set[tag] = struct{}{}
	}
	for _, tag := range normalizeTags(addTags) {
		set[tag] = struct{}{}
	}
	for _, tag := range normalizeTags(removeTags) {
		delete(set, tag)
	}
	out := make([]string, 0, len(set))
	for tag := range set {
		out = append(out, tag)
	}
	sort.Strings(out)
	return out
}
