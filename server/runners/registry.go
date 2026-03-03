package runners

import (
	"sync"

	"github.com/devzeebo/bifrost/core"
)

// Registry provides thread-safe registration and lookup for runners.
type Registry struct {
	mu     sync.RWMutex
	runners map[string]core.Runner
}

// NewRegistry creates a new runner registry.
func NewRegistry() *Registry {
	return &Registry{
		runners: make(map[string]core.Runner),
	}
}

// Register adds a runner to the registry with the given name.
func (r *Registry) Register(name string, runner core.Runner) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.runners[name] = runner
}

// Get retrieves a runner by name. Returns nil if not found.
func (r *Registry) Get(name string) core.Runner {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.runners[name]
}

// globalRegistry is the default registry instance.
var globalRegistry = NewRegistry()

// Register adds a runner to the global registry.
func Register(name string, runner core.Runner) {
	globalRegistry.Register(name, runner)
}

// Get retrieves a runner from the global registry.
func Get(name string) core.Runner {
	return globalRegistry.Get(name)
}
