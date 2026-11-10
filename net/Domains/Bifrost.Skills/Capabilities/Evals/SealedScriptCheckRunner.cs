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
    static readonly Regex ExportDefaultFunction = new(
        @"^\s*export\s+default\s+function\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*\((?<params>[^)]*)\)\s*(?::\s*[^{]+)?\{",
        RegexOptions.Compiled | RegexOptions.Multiline | RegexOptions.CultureInvariant
    );

    static readonly Regex ParamTypeAnnotation = new(
        @":\s*[A-Za-z_][A-Za-z0-9_<>,\s|?]*(?=\s*[,)=])",
        RegexOptions.Compiled | RegexOptions.CultureInvariant
    );

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
        catch (JavaScriptException ex)
        {
            return Failed(ex.Message);
        }
        catch (JintException ex)
        {
            return Failed(ex.Message);
        }
    }

    int ResolveTimeoutMs(int requested)
    {
        if (requested > 0)
        {
            return requested;
        }

        var fallback = options.CurrentValue.DefaultTimeoutMs;
        return fallback > 0 ? fallback : 5000;
    }

    static ScriptCheckResult Failed(string reason) =>
        new()
        {
            Status = EvalCheckVerdictStatuses.Failed,
            Reason = string.IsNullOrWhiteSpace(reason) ? "Script check failed." : reason.Trim(),
        };

    public static string ToRunnableJavaScript(string script)
    {
        var withoutComments = StripLineComments(script);
        var match = ExportDefaultFunction.Match(withoutComments);
        string body;
        if (match.Success)
        {
            var name = match.Groups["name"].Value;
            var parameters = ParamTypeAnnotation.Replace(match.Groups["params"].Value, "");
            var opener = $"function {name}({parameters.Trim()}) {{";
            body = string.Concat(
                withoutComments.AsSpan(0, match.Index),
                opener,
                withoutComments.AsSpan(match.Index + match.Length)
            );
        }
        else
        {
            body = withoutComments;
        }

        body = ParamTypeAnnotation.Replace(body, "");
        body = body.Replace("export default ", "", StringComparison.Ordinal);
        return body;
    }

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
