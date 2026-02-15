package server

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRun(t *testing.T) {
	t.Run("starts HTTP server that accepts connections", func(t *testing.T) {
		tc := newRunTestContext(t)

		// Given
		tc.valid_config()

		// When
		tc.run_server()

		// Then
		tc.server_is_listening()
	})

	t.Run("shuts down gracefully when context is cancelled", func(t *testing.T) {
		tc := newRunTestContext(t)

		// Given
		tc.valid_config()
		tc.run_server()
		tc.server_is_listening()

		// When
		tc.cancel_context()

		// Then
		tc.run_returns_without_error()
	})

	t.Run("returns error for unsupported DB driver", func(t *testing.T) {
		tc := newRunTestContext(t)

		// Given
		tc.config_with_db_driver("postgres")

		// When
		tc.run_server_sync()

		// Then
		tc.run_returned_error_containing("unsupported")
	})
}

// --- Test Context ---

type runTestContext struct {
	t      *testing.T
	cfg    *Config
	ctx    context.Context
	cancel context.CancelFunc
	runErr error
	done   chan struct{}
}

func newRunTestContext(t *testing.T) *runTestContext {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	return &runTestContext{
		t:      t,
		ctx:    ctx,
		cancel: cancel,
		done:   make(chan struct{}),
	}
}

// --- Given ---

func (tc *runTestContext) valid_config() {
	tc.t.Helper()
	port := tc.freePort()
	tc.cfg = &Config{
		DBDriver:        "sqlite",
		DBPath:          ":memory:",
		Port:            port,
		CatchUpInterval: 100 * time.Millisecond,
	}
}

func (tc *runTestContext) config_with_db_driver(driver string) {
	tc.t.Helper()
	port := tc.freePort()
	tc.cfg = &Config{
		DBDriver:        driver,
		DBPath:          ":memory:",
		Port:            port,
		CatchUpInterval: 100 * time.Millisecond,
	}
}

// --- When ---

func (tc *runTestContext) run_server() {
	tc.t.Helper()
	go func() {
		tc.runErr = Run(tc.ctx, tc.cfg)
		close(tc.done)
	}()
	// Wait for server to be ready
	tc.waitForServer()
}

func (tc *runTestContext) run_server_sync() {
	tc.t.Helper()
	tc.runErr = Run(tc.ctx, tc.cfg)
}

func (tc *runTestContext) cancel_context() {
	tc.t.Helper()
	tc.cancel()
}

// --- Then ---

func (tc *runTestContext) server_is_listening() {
	tc.t.Helper()
	resp, err := http.Get(fmt.Sprintf("http://127.0.0.1:%d/", tc.cfg.Port))
	require.NoError(tc.t, err, "server should be listening")
	resp.Body.Close()
}

func (tc *runTestContext) run_returns_without_error() {
	tc.t.Helper()
	select {
	case <-tc.done:
		assert.NoError(tc.t, tc.runErr)
	case <-time.After(5 * time.Second):
		tc.t.Fatal("Run did not return within 5 seconds after context cancellation")
	}
}

func (tc *runTestContext) run_returned_error_containing(substr string) {
	tc.t.Helper()
	require.Error(tc.t, tc.runErr)
	assert.Contains(tc.t, tc.runErr.Error(), substr)
}

// --- Helpers ---

func (tc *runTestContext) freePort() int {
	tc.t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(tc.t, err)
	port := l.Addr().(*net.TCPAddr).Port
	l.Close()
	return port
}

func (tc *runTestContext) waitForServer() {
	tc.t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", tc.cfg.Port), 50*time.Millisecond)
		if err == nil {
			conn.Close()
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	tc.t.Fatal("server did not start within 3 seconds")
}
