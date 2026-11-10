using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Bifrost.Capabilities.Evals;

public static class EvalRunsServiceCollectionExtensions
{
    extension(IServiceCollection services)
    {
        public IServiceCollection AddEvalRuns()
        {
            services
                .AddOptions<ScriptCheckOptions>()
                .BindConfiguration(ScriptCheckOptions.SectionName);
            services.TryAddSingleton<EvalRunCancellation>();
            services.TryAddSingleton<IScriptCheckRunner, SealedScriptCheckRunner>();
            services.TryAddScoped<EvalRunExecutor>();
            return services;
        }
    }
}
