using Bifrost.Capabilities.Commands;
using Bifrost.MessageBus;
using Bifrost.Rpc;
using Bifrost.Skills.Contracts;
using Marten;
using Marten.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Wolverine;

namespace Bifrost;

public static class SkillsServiceCollectionExtensions
{
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Registers skills handlers that deserialize <see cref="BusMessage"/> payloads into Api contracts
        /// and invoke them through Wolverine.
        /// </summary>
        public IServiceCollection AddSkillsHandlers()
        {
            ArgumentNullException.ThrowIfNull(services);

            services.Command<CreateCapabilityApi.Command>();
            services.Command<AmendCapabilityAskApi.Command>();
            services.Command<AmendCapabilityEvalApi.Command>();
            services.Command<DuplicateCapabilityEvalApi.Command>();
            services.Command<RetireCapabilityEvalApi.Command>();
            services.Command<RenameCapabilityApi.Command>();
            services.Command<SaveDerivedSkillApi.Command>();
            services.Command<RestoreCapabilityVersionApi.Command>();
            services.Command<RestoreSkillVersionApi.Command>();
            services.Command<PostCapabilityChatMessageApi.Command>();
            services.Command<ApplyCapabilityProposalApi.Command>();
            services.Command<DismissCapabilityProposalApi.Command>();
            services.Command<RereadCapabilityProposalApi.Command>();
            services.Command<RunCapabilityEvalApi.Command>();
            services.Command<RunCapabilitySuiteApi.Command>();
            services.Command<CancelEvalSuiteRunApi.Command>();

            services.Query<GetCapabilityApi.Query, GetCapabilityApi.Response>();
            services.Query<ListCapabilitiesApi.Query, ListCapabilitiesApi.Response>();
            services.Query<ListCapabilityVersionsApi.Query, ListCapabilityVersionsApi.Response>();
            services.Query<GetCapabilityVersionApi.Query, GetCapabilityVersionApi.Response>();
            services.Query<
                CompareCapabilityVersionsApi.Query,
                CompareCapabilityVersionsApi.Response
            >();
            services.Query<ListSkillVersionsApi.Query, ListSkillVersionsApi.Response>();
            services.Query<GetSkillVersionApi.Query, GetSkillVersionApi.Response>();
            services.Query<CompareSkillVersionsApi.Query, CompareSkillVersionsApi.Response>();
            services.Query<GetCapabilityChatApi.Query, GetCapabilityChatApi.Response>();
            services.Query<GetEvalCaseRunApi.Query, GetEvalCaseRunApi.Response>();
            services.Query<GetEvalSuiteRunApi.Query, GetEvalSuiteRunApi.Response>();
            services.Query<ListEvalCaseRunsApi.Query, ListEvalCaseRunsApi.Response>();
            services.Query<
                GetCapabilityEvalOutcomesApi.Query,
                GetCapabilityEvalOutcomesApi.Response
            >();
            return services;
        }

        void Command<TCommand>()
            where TCommand : class
        {
            services.AddMessageBusHandler<TCommand>(
                async (sp, command, ct) =>
                {
                    await using var scope = sp.CreateAsyncScope();
                    try
                    {
                        await scope
                            .ServiceProvider.GetRequiredService<IMessageBus>()
                            .InvokeAsync(command, ct);
                    }
                    catch (CommandValidationException ex)
                    {
                        throw new BusException(
                            new BusError { Code = BusErrorCodes.Validation, Message = ex.Message }
                        );
                    }
                    catch (ContractValidationException ex)
                    {
                        throw new BusException(
                            new BusError { Code = BusErrorCodes.Validation, Message = ex.Message }
                        );
                    }
                    catch (ExistingStreamIdCollisionException ex)
                    {
                        throw new BusException(
                            new BusError
                            {
                                Code = BusErrorCodes.Validation,
                                Message = $"Capability {ex.Id} already exists.",
                            }
                        );
                    }
                    catch (Exception ex) when (CapabilityNames.TryGetConflictingName(ex, out var name))
                    {
                        await using var session = scope
                            .ServiceProvider.GetRequiredService<IDocumentStore>()
                            .QuerySession();
                        throw new BusException(
                            new BusError
                            {
                                Code = BusErrorCodes.Validation,
                                Message = await CapabilityNames.ConflictDetail(session, name),
                            }
                        );
                    }
                }
            );
        }

        void Query<TQuery, TResponse>()
            where TQuery : class
        {
            services.AddMessageBusHandler<TQuery, TResponse>(
                async (sp, query, ct) =>
                {
                    await using var scope = sp.CreateAsyncScope();
                    try
                    {
                        return await scope
                            .ServiceProvider.GetRequiredService<IMessageBus>()
                            .InvokeAsync<TResponse>(query, ct);
                    }
                    catch (CommandValidationException ex)
                    {
                        throw new BusException(
                            new BusError { Code = BusErrorCodes.Validation, Message = ex.Message }
                        );
                    }
                    catch (ContractValidationException ex)
                    {
                        throw new BusException(
                            new BusError { Code = BusErrorCodes.Validation, Message = ex.Message }
                        );
                    }
                }
            );
        }
    }
}
