using Bifrost.Capabilities.Projections;
using Marten;

namespace Bifrost.Capabilities.Commands;

static class CapabilityNames
{
    public static async Task EnsureAvailable(
        IQuerySession session,
        string trimmedName,
        Guid? exceptCapabilityId = null
    )
    {
        var holder = await session
            .Query<CapabilityIndex.Model>()
            .Where(x => x.Name == trimmedName)
            .FirstOrDefaultAsync();

        if (holder is null)
        {
            return;
        }

        if (exceptCapabilityId is { } id && holder.Id == id)
        {
            return;
        }

        throw new CommandValidationException(
            $"Name \"{trimmedName}\" is already held by capability {holder.Id}."
        );
    }
}
