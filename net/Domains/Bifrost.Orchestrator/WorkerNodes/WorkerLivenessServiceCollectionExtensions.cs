using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Bifrost.WorkerNodes;

public static class WorkerLivenessServiceCollectionExtensions
{
    extension(IServiceCollection services)
    {
        public IServiceCollection AddWorkerLiveness(IConfiguration configuration)
        {
            ArgumentNullException.ThrowIfNull(services);
            ArgumentNullException.ThrowIfNull(configuration);

            services
                .AddOptions<WorkerLivenessOptions>()
                .Bind(configuration.GetSection(WorkerLivenessOptions.SectionName));
            services.AddHostedService<WorkerLivenessDetector>();
            return services;
        }
    }
}
