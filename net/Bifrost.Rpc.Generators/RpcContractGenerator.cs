using System.Collections.Immutable;
using System.Linq;
using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Text;

namespace Bifrost.Rpc.Generators;

[Generator]
public sealed class RpcContractGenerator : IIncrementalGenerator
{
    public void Initialize(IncrementalGeneratorInitializationContext context)
    {
        var contracts = context
            .SyntaxProvider.CreateSyntaxProvider(
                static (node, _) => node is InterfaceDeclarationSyntax { BaseList: not null },
                static (ctx, _) => GetContract(ctx)
            )
            .Where(static m => m is not null)
            .Select(static (m, _) => m!);

        context.RegisterSourceOutput(
            contracts.Collect(),
            static (spc, models) => Execute(spc, models)
        );
    }

    sealed class RpcContractModel
    {
        public string? Namespace { get; }
        public string Name { get; }
        public string FullName { get; }
        public List<RpcMethodModel> Methods { get; }

        public RpcContractModel(
            string? ns,
            string name,
            string fullName,
            List<RpcMethodModel> methods
        )
        {
            Namespace = ns;
            Name = name;
            FullName = fullName;
            Methods = methods;
        }
    }

    sealed class RpcMethodModel
    {
        public string Name { get; }
        public string RpcName { get; }
        public string ReturnType { get; }
        public string? ResultType { get; }
        public bool IsNotification { get; }
        public bool IsValueTask { get; }
        public List<RpcParamModel> Parameters { get; }
        public string? CancellationTokenName { get; }

        public RpcMethodModel(
            string name,
            string rpcName,
            string returnType,
            string? resultType,
            bool isNotification,
            bool isValueTask,
            List<RpcParamModel> parameters,
            string? cancellationTokenName
        )
        {
            Name = name;
            RpcName = rpcName;
            ReturnType = returnType;
            ResultType = resultType;
            IsNotification = isNotification;
            IsValueTask = isValueTask;
            Parameters = parameters;
            CancellationTokenName = cancellationTokenName;
        }
    }

    sealed class RpcParamModel
    {
        public string Name { get; }
        public string Type { get; }

        public RpcParamModel(string name, string type)
        {
            Name = name;
            Type = type;
        }
    }

    static RpcContractModel? GetContract(GeneratorSyntaxContext context)
    {
        var syntax = (InterfaceDeclarationSyntax)context.Node;
        if (context.SemanticModel.GetDeclaredSymbol(syntax) is not INamedTypeSymbol symbol)
        {
            return null;
        }

        if (symbol.ToDisplayString() == IRpcContract || !ImplementsRpcContract(symbol))
        {
            return null;
        }

        var methods = new List<RpcMethodModel>();
        foreach (var member in symbol.GetMembers().OfType<IMethodSymbol>())
        {
            if (member.MethodKind != MethodKind.Ordinary || member.IsStatic)
            {
                continue;
            }

            var model = TryCreateMethod(member);
            if (model is not null)
            {
                methods.Add(model);
            }
        }

        return new RpcContractModel(
            symbol.ContainingNamespace.IsGlobalNamespace
                ? null
                : symbol.ContainingNamespace.ToDisplayString(),
            symbol.Name,
            symbol.ToDisplayString(SymbolDisplayFormat.FullyQualifiedFormat),
            methods
        );
    }

    static bool ImplementsRpcContract(INamedTypeSymbol symbol) =>
        symbol.AllInterfaces.Any(i => i.ToDisplayString() == IRpcContract);

    static RpcMethodModel? TryCreateMethod(IMethodSymbol method)
    {
        var rpcNameAttr = method
            .GetAttributes()
            .FirstOrDefault(a => a.AttributeClass?.ToDisplayString() == RpcMethodAttr);
        var rpcName =
            rpcNameAttr?.ConstructorArguments.Length > 0
                ? rpcNameAttr.ConstructorArguments[0].Value as string
                : null;

        if (method.ReturnType is not INamedTypeSymbol returnType)
        {
            return null;
        }

        var returnDisplay = returnType.ToDisplayString(SymbolDisplayFormat.FullyQualifiedFormat);
        string? resultType = null;
        var isValueTask = false;

        if (
            returnType.Name == "Task"
            && returnType.ContainingNamespace.ToDisplayString() == "System.Threading.Tasks"
        )
        {
            if (returnType.IsGenericType)
            {
                resultType = returnType
                    .TypeArguments[0]
                    .ToDisplayString(SymbolDisplayFormat.FullyQualifiedFormat);
            }
        }
        else if (
            returnType.Name == "ValueTask"
            && returnType.ContainingNamespace.ToDisplayString() == "System.Threading.Tasks"
        )
        {
            isValueTask = true;
            if (returnType.IsGenericType)
            {
                resultType = returnType
                    .TypeArguments[0]
                    .ToDisplayString(SymbolDisplayFormat.FullyQualifiedFormat);
            }
        }
        else
        {
            return null;
        }

        // Non-generic Task/ValueTask => notification; Task<T>/ValueTask<T> (incl. Unit) => request
        var isNotification = resultType is null;

        var parameters = new List<RpcParamModel>();
        IParameterSymbol? ctParam = null;
        foreach (var p in method.Parameters)
        {
            if (p.Type.ToDisplayString() == "System.Threading.CancellationToken")
            {
                ctParam = p;
                continue;
            }

            parameters.Add(
                new RpcParamModel(
                    p.Name,
                    p.Type.ToDisplayString(SymbolDisplayFormat.FullyQualifiedFormat)
                )
            );
        }

        if (
            ctParam is not null
            && !SymbolEqualityComparer.Default.Equals(ctParam, method.Parameters.Last())
        )
        {
            return null;
        }

        var interfaceName = method.ContainingType.Name;
        var defaultRpc = $"{interfaceName}.{method.Name}";

        return new RpcMethodModel(
            method.Name,
            rpcName ?? defaultRpc,
            returnDisplay,
            resultType,
            isNotification,
            isValueTask,
            parameters,
            ctParam?.Name
        );
    }

    static void Execute(SourceProductionContext context, ImmutableArray<RpcContractModel> contracts)
    {
        if (contracts.IsDefaultOrEmpty)
        {
            return;
        }

        var distinct = contracts
            .GroupBy(c => c.FullName)
            .Select(g => g.First())
            .OrderBy(c => c.FullName)
            .ToList();

        var sb = new StringBuilder();
        sb.AppendLine("// <auto-generated/>");
        sb.AppendLine("#nullable enable");
        sb.AppendLine("using System;");
        sb.AppendLine("using System.Runtime.CompilerServices;");
        sb.AppendLine("using System.Text.Json;");
        sb.AppendLine("using System.Threading;");
        sb.AppendLine("using System.Threading.Tasks;");
        sb.AppendLine("using Bifrost.Rpc;");
        sb.AppendLine();

        foreach (var contract in distinct)
        {
            WriteContract(sb, contract);
        }

        context.AddSource("RpcContracts.g.cs", SourceText.From(sb.ToString(), Encoding.UTF8));
    }

    static void WriteContract(StringBuilder sb, RpcContractModel contract)
    {
        if (contract.Namespace is not null)
        {
            sb.AppendLine($"namespace {contract.Namespace}");
            sb.AppendLine("{");
        }

        var indent = contract.Namespace is null ? "" : "    ";
        var proxyName = $"{contract.Name}RpcProxy";
        var bindingName = $"{contract.Name}RpcBinding";
        var moduleName = $"{contract.Name}RpcModule";

        sb.AppendLine(
            $"{indent}/// <summary>Generated proxy for <see cref=\"{contract.FullName}\"/>.</summary>"
        );
        sb.AppendLine($"{indent}internal sealed class {proxyName} : {contract.FullName}");
        sb.AppendLine($"{indent}{{");
        sb.AppendLine($"{indent}    readonly RpcSession _session;");
        sb.AppendLine(
            $"{indent}    public {proxyName}(RpcSession session) => _session = session ?? throw new ArgumentNullException(nameof(session));"
        );
        sb.AppendLine();

        foreach (var method in contract.Methods)
        {
            WriteProxyMethod(sb, indent, method);
        }

        sb.AppendLine($"{indent}}}");
        sb.AppendLine();

        sb.AppendLine(
            $"{indent}/// <summary>Generated binding for <see cref=\"{contract.FullName}\"/>.</summary>"
        );
        sb.AppendLine(
            $"{indent}internal sealed class {bindingName} : IRpcBinding<{contract.FullName}>"
        );
        sb.AppendLine($"{indent}{{");
        sb.AppendLine(
            $"{indent}    public {contract.FullName} CreateProxy(RpcSession session) => new {proxyName}(session);"
        );
        sb.AppendLine();
        sb.AppendLine(
            $"{indent}    public void Subscribe(RpcSession session, {contract.FullName} implementation)"
        );
        sb.AppendLine($"{indent}    {{");
        sb.AppendLine(
            $"{indent}        if (session is null) throw new ArgumentNullException(nameof(session));"
        );
        sb.AppendLine(
            $"{indent}        if (implementation is null) throw new ArgumentNullException(nameof(implementation));"
        );

        foreach (var method in contract.Methods)
        {
            WriteSubscribeMap(sb, indent, method);
        }

        sb.AppendLine($"{indent}    }}");
        sb.AppendLine($"{indent}}}");
        sb.AppendLine();

        sb.AppendLine($"{indent}internal static class {moduleName}");
        sb.AppendLine($"{indent}{{");
        sb.AppendLine($"{indent}    [ModuleInitializer]");
        sb.AppendLine(
            $"{indent}    internal static void Register() => RpcBindings.Register<{contract.FullName}>(new {bindingName}());"
        );
        sb.AppendLine($"{indent}}}");

        if (contract.Namespace is not null)
        {
            sb.AppendLine("}");
        }

        sb.AppendLine();
    }

    static void WriteProxyMethod(StringBuilder sb, string indent, RpcMethodModel method)
    {
        var paramList = string.Join(
            ", ",
            method
                .Parameters.Select(p => $"{p.Type} {p.Name}")
                .Concat(
                    method.CancellationTokenName is { } ct
                        ? new[] { $"global::System.Threading.CancellationToken {ct} = default" }
                        : Array.Empty<string>()
                )
        );

        sb.AppendLine($"{indent}    public {method.ReturnType} {method.Name}({paramList})");
        sb.AppendLine($"{indent}    {{");

        var ctArg = method.CancellationTokenName ?? "default";
        var paramsExpr =
            method.Parameters.Count == 0
                ? "null"
                : $"new {{ {string.Join(", ", method.Parameters.Select(p => p.Name))} }}";

        if (method.IsNotification)
        {
            var call = $"_session.Notify(\"{Escape(method.RpcName)}\", {paramsExpr}, {ctArg})";
            sb.AppendLine(
                method.IsValueTask
                    ? $"{indent}        return new ValueTask({call});"
                    : $"{indent}        return {call};"
            );
        }
        else
        {
            var call =
                $"_session.Invoke<{method.ResultType}>(\"{Escape(method.RpcName)}\", {paramsExpr}, {ctArg})";
            sb.AppendLine(
                method.IsValueTask
                    ? $"{indent}        return new ValueTask<{method.ResultType}>({call});"
                    : $"{indent}        return {call};"
            );
        }

        sb.AppendLine($"{indent}    }}");
        sb.AppendLine();
    }

    static void WriteSubscribeMap(StringBuilder sb, string indent, RpcMethodModel method)
    {
        sb.AppendLine(
            $"{indent}        session.Map(\"{Escape(method.RpcName)}\", (Func<JsonElement?, CancellationToken, Task<object?>>)(async (paramsElement, ct) =>"
        );
        sb.AppendLine($"{indent}        {{");

        for (var i = 0; i < method.Parameters.Count; i++)
        {
            var p = method.Parameters[i];
            sb.AppendLine($"{indent}            {p.Type} {p.Name} = default!;");
            sb.AppendLine(
                $"{indent}            if (paramsElement is {{ ValueKind: JsonValueKind.Object }} pobj{i} && pobj{i}.TryGetProperty(\"{Escape(p.Name)}\", out var el{i}))"
            );
            sb.AppendLine(
                $"{indent}                {p.Name} = JsonSerializer.Deserialize<{p.Type}>(el{i}.GetRawText(), RpcSession.SerializerOptions)!;"
            );
        }

        var args = string.Join(
            ", ",
            method
                .Parameters.Select(p => p.Name)
                .Concat(
                    method.CancellationTokenName is not null
                        ? new[] { "ct" }
                        : Array.Empty<string>()
                )
        );

        if (method.IsNotification)
        {
            sb.AppendLine(
                $"{indent}            await implementation.{method.Name}({args}).ConfigureAwait(false);"
            );
            sb.AppendLine($"{indent}            return null;");
        }
        else
        {
            sb.AppendLine(
                $"{indent}            return await implementation.{method.Name}({args}).ConfigureAwait(false);"
            );
        }

        sb.AppendLine($"{indent}        }}));");
    }

    static string Escape(string value) => value.Replace("\\", "\\\\").Replace("\"", "\\\"");

    const string IRpcContract = "Bifrost.Rpc.IRpcContract";
    const string RpcMethodAttr = "Bifrost.Rpc.RpcMethodAttribute";
}
