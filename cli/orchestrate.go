package cli

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"os/user"
	"sync"
	"syscall"
	"time"

	"github.com/spf13/cobra"
)

// OrchestrateConfig holds the orchestrate section of .bifrost.yaml.
type OrchestrateConfig struct {
	Dispatcher   string        `mapstructure:"dispatcher"`
	PollInterval time.Duration `mapstructure:"poll_interval"`
	Concurrency  int           `mapstructure:"concurrency"`
	Claimant     string        `mapstructure:"claimant"`
}

// OrchestrateCmd is the bf orchestrate command.
type OrchestrateCmd struct {
	Command *cobra.Command
}

func NewOrchestrateCmd(clientFn func() *Client, cfgFn func() *Config) *OrchestrateCmd {
	c := &OrchestrateCmd{}

	cmd := &cobra.Command{
		Use:   "orchestrate",
		Short: "Poll for ready runes and dispatch them to configured agents",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := cfgFn()

			// Resolve effective config: flags override yaml config.
			oCfg := cfg.Orchestrate

			if v, _ := cmd.Flags().GetString("dispatcher"); v != "" {
				oCfg.Dispatcher = v
			}
			if v, _ := cmd.Flags().GetDuration("poll-interval"); v != 0 {
				oCfg.PollInterval = v
			}
			if v, _ := cmd.Flags().GetInt("concurrency"); v != 0 {
				oCfg.Concurrency = v
			}
			if v, _ := cmd.Flags().GetString("claimant"); v != "" {
				oCfg.Claimant = v
			}

			// Apply defaults.
			if oCfg.PollInterval == 0 {
				oCfg.PollInterval = 10 * time.Second
			}
			if oCfg.Concurrency == 0 {
				oCfg.Concurrency = 1
			}
			if oCfg.Claimant == "" {
				if u, err := user.Current(); err == nil {
					oCfg.Claimant = u.Username
				}
			}

			// Validate configuration values.
			if oCfg.Concurrency <= 0 {
				return fmt.Errorf("concurrency must be positive, got %d", oCfg.Concurrency)
			}
			if oCfg.PollInterval <= 0 {
				return fmt.Errorf("poll-interval must be positive, got %s", oCfg.PollInterval)
			}

			if oCfg.Dispatcher == "" {
				return fmt.Errorf("dispatcher is required: set orchestrate.dispatcher in .bifrost.yaml or use --dispatcher")
			}

			// Validate dispatcher is accessible.
			if _, err := os.Stat(oCfg.Dispatcher); err != nil {
				return fmt.Errorf("dispatcher script not found: %s", oCfg.Dispatcher)
			}

			saga, _ := cmd.Flags().GetString("saga")
			dryRun, _ := cmd.Flags().GetBool("dry-run")
			once, _ := cmd.Flags().GetBool("once")
			unclaimOnFailure, _ := cmd.Flags().GetBool("unclaim-on-failure")

			dispatcher := &ScriptDispatcher{ScriptPath: oCfg.Dispatcher}

			ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
			defer cancel()

			return runOrchestrator(ctx, clientFn(), oCfg, dispatcher, saga, dryRun, once, unclaimOnFailure)
		},
	}

	cmd.Flags().String("dispatcher", "", "path to dispatcher script (overrides config)")
	cmd.Flags().Duration("poll-interval", 0, "polling interval (default 10s)")
	cmd.Flags().Int("concurrency", 0, "number of parallel workers (default 1)")
	cmd.Flags().String("claimant", "", "claimant name (default: system username)")
	cmd.Flags().Bool("unclaim-on-failure", false, "unclaim rune when dispatched command exits non-zero")
	cmd.Flags().String("saga", "", "only orchestrate runes in this saga")
	cmd.Flags().Bool("dry-run", false, "resolve dispatch but do not execute or fulfill")
	cmd.Flags().Bool("once", false, "process one batch then exit")

	c.Command = cmd
	return c
}

func runOrchestrator(
	ctx context.Context,
	client *Client,
	cfg OrchestrateConfig,
	dispatcher Dispatcher,
	saga string,
	dryRun, once, unclaimOnFailure bool,
) error {
	queue := make(chan map[string]any, cfg.Concurrency*2)
	var inFlight sync.Map

	var wg sync.WaitGroup
	for i := 0; i < cfg.Concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case rune, ok := <-queue:
					if !ok {
						return
					}
					processRune(ctx, client, cfg, dispatcher, rune, dryRun, unclaimOnFailure, &inFlight)
				}
			}
		}()
	}

	poll := func() {
		runes, err := fetchReadyRunes(client, saga)
		if err != nil {
			fmt.Fprintf(os.Stderr, "orchestrate: poll error: %v\n", err)
			return
		}

		for _, r := range runes {
			id, _ := r["id"].(string)
			if id == "" {
				continue
			}
			// Skip if already claimed by someone else.
			if claimant, _ := r["claimant"].(string); claimant != "" {
				continue
			}
			// Skip if already in-flight.
			if _, loaded := inFlight.LoadOrStore(id, struct{}{}); loaded {
				continue
			}
			// Blocking send in --once mode to guarantee all items are enqueued.
			// Non-blocking send otherwise — if queue is full, release from in-flight and skip.
			if once {
				queue <- r
			} else {
				select {
				case queue <- r:
				default:
					inFlight.Delete(id)
				}
			}
		}
	}

	// Run first poll immediately.
	poll()

	if once {
		// Wait for queue to drain, then shut down workers.
		// We close the queue after the first poll drains.
		// We signal workers by closing the channel once all items are enqueued.
		// But since queue is buffered and workers are async, we need to wait
		// for in-flight items to complete. We do this by closing queue and
		// waiting for wg.
		close(queue)
		wg.Wait()
		return nil
	}

	ticker := time.NewTicker(cfg.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			close(queue)
			wg.Wait()
			return nil
		case <-ticker.C:
			poll()
		}
	}
}

func fetchReadyRunes(client *Client, saga string) ([]map[string]any, error) {
	params := map[string]string{
		"status":  "open",
		"blocked": "false",
		"is_saga": "false",
	}
	if saga != "" {
		params["saga"] = saga
	}

	body, err := client.DoGetWithParams("/runes", params)
	if err != nil {
		return nil, err
	}

	var runes []map[string]any
	if err := json.Unmarshal(body, &runes); err != nil {
		return nil, fmt.Errorf("parsing runes response: %w", err)
	}
	return runes, nil
}

func processRune(
	ctx context.Context,
	client *Client,
	cfg OrchestrateConfig,
	dispatcher Dispatcher,
	summary map[string]any,
	dryRun, unclaimOnFailure bool,
	inFlight *sync.Map,
) {
	id, _ := summary["id"].(string)
	defer inFlight.Delete(id)

	// Fetch full rune detail.
	detail, err := fetchRuneDetail(client, id)
	if err != nil {
		fmt.Fprintf(os.Stderr, "orchestrate: [%s] fetch detail error: %v\n", id, err)
		return
	}

	// Claim the rune.
	if err := claimRune(client, id, cfg.Claimant); err != nil {
		fmt.Fprintf(os.Stderr, "orchestrate: [%s] claim error: %v\n", id, err)
		return
	}

	// Resolve dispatch.
	input := dispatchInputFromRune(detail)
	result, err := dispatcher.Dispatch(ctx, input)
	if err != nil {
		fmt.Fprintf(os.Stderr, "orchestrate: [%s] dispatcher error: %v\n", id, err)
		unclaimRune(client, id)
		return
	}

	// Empty command means skip.
	if result.Command == "" {
		fmt.Fprintf(os.Stderr, "orchestrate: [%s] no handler, unclaiming\n", id)
		unclaimRune(client, id)
		return
	}

	if dryRun {
		fmt.Fprintf(os.Stderr, "orchestrate: [%s] dry-run: would invoke: %s %v\n", id, result.Command, result.Args)
		unclaimRune(client, id)
		return
	}

	fmt.Fprintf(os.Stderr, "orchestrate: [%s] invoking: %s %v\n", id, result.Command, result.Args)

	exitCode, err := RunDispatched(ctx, result, os.Stdout, os.Stderr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "orchestrate: [%s] exec error: %v\n", id, err)
		if unclaimOnFailure {
			unclaimRune(client, id)
		}
		return
	}

	if exitCode != 0 {
		fmt.Fprintf(os.Stderr, "orchestrate: [%s] agent exited with code %d\n", id, exitCode)
		if unclaimOnFailure {
			unclaimRune(client, id)
		}
		return
	}

	if err := fulfillRune(client, id); err != nil {
		fmt.Fprintf(os.Stderr, "orchestrate: [%s] fulfill error: %v\n", id, err)
	}
}

func fetchRuneDetail(client *Client, id string) (map[string]any, error) {
	body, err := client.DoGetWithParams("/rune", map[string]string{"id": id})
	if err != nil {
		return nil, err
	}
	var detail map[string]any
	if err := json.Unmarshal(body, &detail); err != nil {
		return nil, fmt.Errorf("parsing rune detail: %w", err)
	}
	return detail, nil
}

func claimRune(client *Client, id, claimant string) error {
	_, err := client.DoPost("/claim-rune", map[string]string{"id": id, "claimant": claimant})
	return err
}

func unclaimRune(client *Client, id string) {
	if _, err := client.DoPost("/unclaim-rune", map[string]string{"id": id}); err != nil {
		fmt.Fprintf(os.Stderr, "orchestrate: [%s] unclaim error: %v\n", id, err)
	}
}

func fulfillRune(client *Client, id string) error {
	_, err := client.DoPost("/fulfill-rune", map[string]string{"id": id})
	return err
}