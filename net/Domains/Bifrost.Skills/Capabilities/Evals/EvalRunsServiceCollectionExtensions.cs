using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Bifrost.Capabilities.Evals;

public static class EvalRunsServiceCollectionExtensions
{
    extension(IServiceCollection services)
    {
        public IServiceCollection AddEvalRuns()
        {
            services.TryAddSingleton<EvalRunCancellation>();
            services.TryAddSingleton<IScriptCheckRunner, UnsettledScriptCheckRunner>();
            services.TryAddScoped<EvalRunExecutor>();
            return services;
        }
    }
}
