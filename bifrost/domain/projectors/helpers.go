package projectors

// removeString removes all occurrences of s from slice.
// Returns a new slice without modifying the original.
func removeString(slice []string, s string) []string {
	var result []string
	for _, item := range slice {
		if item != s {
			result = append(result, item)
		}
	}
	return result
}
