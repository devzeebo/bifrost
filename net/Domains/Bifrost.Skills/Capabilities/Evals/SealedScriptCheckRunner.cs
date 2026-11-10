using System.Text.RegularExpressions;
using Bifrost.Skills.Contracts;
using Jint;
using Jint.Native;
using Jint.Native.Function;
using Jint.Runtime;
using Microsoft.Extensions.Options;

namespace Bifrost.Capabilities.Evals;

/// <summary>
/// Runs authored TypeScript script checks in-process under a sealed Jint bag:
/// transcript and context strings only — no host APIs, no network.
/// </summary>
public sealed class SealedScriptCheckRunner(IOptionsMonitor<ScriptCheckOptions> options)
    : IScriptCheckRunner
{
    static readonly Regex FunctionHeader = new(
        @"(?:export\s+default\s+)?function\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*\((?<params>[^)]*)\)\s*(?::\s*[^{]+)?\{",
        RegexOptions.Compiled | RegexOptions.CultureInvariant
    );

    static readonly Regex ParamTypeAnnotation = new(
        @":\s*[A-Za-z_][A-Za-z0-9_<>,\s|?]*(?=\s*[,)=])",
        RegexOptions.Compiled | RegexOptions.CultureInvariant
    );

    /// <summary>
    /// Executes one sealed script check and never throws for script failures.
    /// Propagates <see cref="OperationCanceledException"/> only when the caller token cancels.
    /// </summary>
    public Task<ScriptCheckResult> Run(ScriptCheckRequest request, CancellationToken ct)
    {
        try
        {
            return Task.FromResult(RunSync(request, ct));
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            return Task.FromResult(Failed(ex.Message));
        }
    }

    /// <summary>
    /// Strips the constrained authoring TypeScript shape into plain JS for Jint,
    /// without rewriting string-literal contents in the script body.
    /// </summary>
    public static string ToRunnableJavaScript(string script)
    {
        var withoutComments = StripLineComments(script);
        var match = FunctionHeader.Match(withoutComments);
        if (!match.Success)
        {
            return withoutComments.Replace("export default ", "", StringComparison.Ordinal);
        }

        // Strip types only from the parameter list — never from the function body,
        // where criterion wording may contain ": word" sequences inside string literals.
        // Append ')' so the last parameter's type still matches the lookahead (params group
        // excludes the closing paren).
        var name = match.Groups["name"].Value;
        var parameters = ParamTypeAnnotation
            .Replace(match.Groups["params"].Value + ")", "")
            .TrimEnd(')')
            .Trim();
        var opener = $"function {name}({parameters}) {{";
        return string.Concat(
            withoutComments.AsSpan(0, match.Index),
            opener,
            withoutComments.AsSpan(match.Index + match.Length)
        );
    }

    ScriptCheckResult RunSync(ScriptCheckRequest request, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        var timeoutMs = ResolveTimeoutMs(request.TimeoutMs);
        if (string.IsNullOrWhiteSpace(request.Script))
        {
            return Failed("Script check has no script body.");
        }

        string js;
        try
        {
            js = ToRunnableJavaScript(request.Script);
        }
        catch (Exception ex)
        {
            return Failed($"Script could not be prepared: {ex.Message}");
        }

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(timeoutMs);
        var runCt = timeoutCts.Token;

        try
        {
            var engine = new Engine(cfg =>
            {
                cfg.TimeoutInterval(TimeSpan.FromMilliseconds(timeoutMs));
                cfg.CancellationToken(runCt);
                // No MaxStatements ceiling: infinite loops must hit the time ceiling, not a statement cap.
                cfg.LimitRecursion(64);
                cfg.Strict();
            });

            engine.Execute(js);
            var check = engine.GetValue("check");
            if (check.IsUndefined() || check.IsNull() || check is not Function)
            {
                return Failed("Script must declare function check(transcript, context).");
            }

            var result = engine.Invoke(
                check,
                request.Transcript ?? "",
                request.Context ?? ""
            );

            if (result.IsBoolean())
            {
                var passed = result.AsBoolean();
                return new ScriptCheckResult
                {
                    Status = passed
                        ? EvalCheckVerdictStatuses.Passed
                        : EvalCheckVerdictStatuses.Failed,
                    Reason = passed
                        ? $"Passed: {request.Statement}"
                        : $"Failed: {request.Statement}",
                };
            }

            return Failed($"Script returned non-boolean ({result.Type}).");
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return Failed($"Timed out after {timeoutMs}ms");
        }
        catch (TimeoutException)
        {
            return Failed($"Timed out after {timeoutMs}ms");
        }
        catch (ExecutionCanceledException)
        {
            if (ct.IsCancellationRequested)
            {
                throw new OperationCanceledException(ct);
            }

            return Failed($"Timed out after {timeoutMs}ms");
        }
        catch (JavaScriptException ex)
        {
            return Failed(ex.Message);
        }
        catch (JintException ex)
        {
            return Failed(ex.Message);
        }
    }

    /// <summary>
    /// Resolves the effective ceiling: requested timeout, else service default, capped by max.
    /// </summary>
    int ResolveTimeoutMs(int requested)
    {
        var settings = options.CurrentValue;
        var max = settings.MaxTimeoutMs > 0 ? settings.MaxTimeoutMs : 60_000;
        var fallback = settings.DefaultTimeoutMs > 0 ? settings.DefaultTimeoutMs : 5000;
        return Math.Min(requested > 0 ? requested : fallback, max);
    }

    static ScriptCheckResult Failed(string reason) =>
        new()
        {
            Status = EvalCheckVerdictStatuses.Failed,
            Reason = string.IsNullOrWhiteSpace(reason) ? "Script check failed." : reason.Trim(),
        };

    static string StripLineComments(string script)
    {
        var lines = script.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n');
        for (var i = 0; i < lines.Length; i++)
        {
            var trimmed = lines[i].TrimStart();
            if (trimmed.StartsWith("//", StringComparison.Ordinal))
            {
                lines[i] = "";
            }
        }

        return string.Join('\n', lines);
    }
}
