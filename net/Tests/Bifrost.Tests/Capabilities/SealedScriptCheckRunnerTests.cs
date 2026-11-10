extern alias Skills;

using Bifrost.Skills.Contracts;
using Microsoft.Extensions.Options;
using Shouldly;
using Skills::Bifrost.Capabilities.Evals;

namespace Bifrost.Tests.Capabilities;

public class SealedScriptCheckRunnerTests
{
    [Fact]
    public async Task passing_script_returns_passed_with_statement_reason()
    {
        var runner = CreateRunner();
        var result = await runner.Run(
            Request(
                """
                export default function check(transcript: string, context: string): boolean {
                  return transcript.includes('ok');
                }
                """,
                transcript: "assistant: ok"
            ),
            CancellationToken.None
        );

        result.Status.ShouldBe(EvalCheckVerdictStatuses.Passed);
        result.Reason.ShouldContain("Statement under test");
    }

    [Fact]
    public async Task failing_script_returns_failed_with_statement_reason()
    {
        var runner = CreateRunner();
        var result = await runner.Run(
            Request(
                """
                export default function check(transcript: string, context: string): boolean {
                  return false;
                }
                """
            ),
            CancellationToken.None
        );

        result.Status.ShouldBe(EvalCheckVerdictStatuses.Failed);
        result.Reason.ShouldStartWith("Failed:");
    }

    [Fact]
    public async Task throwing_script_returns_failed_with_error_reason()
    {
        var runner = CreateRunner();
        var result = await runner.Run(
            Request(
                """
                export default function check(transcript: string, context: string): boolean {
                  throw new Error('boom from check');
                }
                """
            ),
            CancellationToken.None
        );

        result.Status.ShouldBe(EvalCheckVerdictStatuses.Failed);
        result.Reason.ShouldContain("boom from check");
    }

    [Fact]
    public async Task empty_script_returns_failed()
    {
        var runner = CreateRunner();
        var result = await runner.Run(Request("  "), CancellationToken.None);

        result.Status.ShouldBe(EvalCheckVerdictStatuses.Failed);
        result.Reason.ShouldContain("no script body");
    }

    [Fact]
    public async Task timeout_returns_failed_naming_ceiling()
    {
        var runner = CreateRunner(defaultTimeoutMs: 5_000);
        var result = await runner.Run(
            Request(
                """
                export default function check(transcript: string, context: string): boolean {
                  while (true) {}
                  return true;
                }
                """,
                timeoutMs: 50
            ),
            CancellationToken.None
        );

        result.Status.ShouldBe(EvalCheckVerdictStatuses.Failed);
        result.Reason.ShouldBe("Timed out after 50ms");
    }

    [Fact]
    public async Task default_timeout_is_used_when_request_omits_ceiling()
    {
        var runner = CreateRunner(defaultTimeoutMs: 40);
        var result = await runner.Run(
            Request(
                """
                export default function check(transcript: string, context: string): boolean {
                  while (true) {}
                  return true;
                }
                """,
                timeoutMs: 0
            ),
            CancellationToken.None
        );

        result.Status.ShouldBe(EvalCheckVerdictStatuses.Failed);
        result.Reason.ShouldBe("Timed out after 40ms");
    }

    [Fact]
    public void to_runnable_javascript_strips_export_and_types()
    {
        var js = SealedScriptCheckRunner.ToRunnableJavaScript(
            """
            // comment
            export default function check(transcript: string, context: string): boolean {
              return true;
            }
            """
        );

        js.ShouldContain("function check(transcript, context)");
        js.ShouldNotContain("export default");
        js.ShouldNotContain(": string");
        js.ShouldNotContain(": boolean");
    }

    [Fact]
    public void to_runnable_javascript_preserves_colon_sequences_inside_string_literals()
    {
        var js = SealedScriptCheckRunner.ToRunnableJavaScript(
            """
            export default function check(transcript: string, context: string): boolean {
              const needle = 'responds in two parts: summary, then detail';
              return transcript.includes(needle);
            }
            """
        );

        js.ShouldContain("responds in two parts: summary, then detail");
        js.ShouldContain("function check(transcript, context)");
    }

    [Fact]
    public async Task colon_in_criterion_string_still_matches_transcript()
    {
        var runner = CreateRunner();
        var result = await runner.Run(
            Request(
                """
                export default function check(transcript: string, context: string): boolean {
                  const needle = 'responds in two parts: summary, then detail';
                  return transcript.toLowerCase().includes(needle);
                }
                """,
                transcript: "assistant: responds in two parts: summary, then detail"
            ),
            CancellationToken.None
        );

        result.Status.ShouldBe(EvalCheckVerdictStatuses.Passed);
    }

    [Fact]
    public async Task requested_timeout_is_clamped_to_service_max()
    {
        var runner = CreateRunner(defaultTimeoutMs: 5_000, maxTimeoutMs: 75);
        var result = await runner.Run(
            Request(
                """
                export default function check(transcript: string, context: string): boolean {
                  while (true) {}
                  return true;
                }
                """,
                timeoutMs: 1_000_000
            ),
            CancellationToken.None
        );

        result.Status.ShouldBe(EvalCheckVerdictStatuses.Failed);
        result.Reason.ShouldBe("Timed out after 75ms");
    }

    [Fact]
    public async Task caller_cancellation_propagates_instead_of_failing_the_check()
    {
        var runner = CreateRunner(defaultTimeoutMs: 5_000);
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        await Should.ThrowAsync<OperationCanceledException>(async () =>
            await runner.Run(
                Request(
                    """
                    export default function check(transcript: string, context: string): boolean {
                      return true;
                    }
                    """
                ),
                cts.Token
            )
        );
    }

    static SealedScriptCheckRunner CreateRunner(
        int defaultTimeoutMs = 5_000,
        int maxTimeoutMs = 60_000
    ) =>
        new(
            new StaticOptionsMonitor(
                new ScriptCheckOptions
                {
                    DefaultTimeoutMs = defaultTimeoutMs,
                    MaxTimeoutMs = maxTimeoutMs,
                }
            )
        );

    static ScriptCheckRequest Request(
        string script,
        string transcript = "assistant: hello",
        string context = "",
        int timeoutMs = 5_000
    ) =>
        new()
        {
            CheckId = Guid.NewGuid(),
            Statement = "Statement under test",
            Script = script,
            Transcript = transcript,
            Context = context,
            TimeoutMs = timeoutMs,
        };

    sealed class StaticOptionsMonitor(ScriptCheckOptions value) : IOptionsMonitor<ScriptCheckOptions>
    {
        public ScriptCheckOptions CurrentValue { get; } = value;

        public ScriptCheckOptions Get(string? name) => CurrentValue;

        public IDisposable? OnChange(Action<ScriptCheckOptions, string?> listener) => null;
    }
}
