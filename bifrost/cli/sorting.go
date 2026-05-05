package cli

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
)

// parseRuneIDSuffix extracts the numeric suffix from a rune ID (e.g., "bf-abcd.10" -> 10)
func parseRuneIDSuffix(id string) int {
	re := regexp.MustCompile(`\.(\d+)$`)
	matches := re.FindStringSubmatch(id)
	if len(matches) == 2 {
		if num, err := strconv.Atoi(matches[1]); err == nil {
			return num
		}
	}
	return 0
}

// isReadyStatus checks if a rune is in a "ready" state (unblocked and unclaimed)
func isReadyStatus(status string) bool {
	return status == "open"
}

// sortRunes sorts runes by: ready status -> priority -> numeric ID suffix
func sortRunes(runes []map[string]any) {
	sort.SliceStable(runes, func(i, j int) bool {
		ri, rj := runes[i], runes[j]
		
		// First sort by ready status (ready = true comes first)
		riReady := isReadyStatus(fmt.Sprintf("%v", ri["status"]))
		rjReady := isReadyStatus(fmt.Sprintf("%v", rj["status"]))
		if riReady != rjReady {
			return riReady
		}
		
		// Then sort by priority (lower numbers = higher priority)
		pi, _ := ri["priority"].(float64)
		pj, _ := rj["priority"].(float64)
		if pi != pj {
			return pi < pj
		}
		
		// Finally sort by numeric ID suffix
		riID := fmt.Sprintf("%v", ri["id"])
		rjID := fmt.Sprintf("%v", rj["id"])
		riNum := parseRuneIDSuffix(riID)
		rjNum := parseRuneIDSuffix(rjID)
		return riNum < rjNum
	})
}