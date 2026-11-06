using System.Text.RegularExpressions;
using Bifrost.Capabilities.Projections;
using Marten;
using Npgsql;

namespace Bifrost.Capabilities.Commands;

static class CapabilityNames
{
    static readonly Regex ConflictingNameDetail = new(
        @"Key \([^)]*name[^)]*\)=\((.*)\) already exists\.",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled
    );

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

        throw new CommandValidationException(HeldMessage(trimmedName, holder.Id));
    }

    public static bool TryGetConflictingName(Exception ex, out string name)
    {
        for (var current = ex; current is not null; current = current.InnerException)
        {
            if (
                current is PostgresException
                {
                    SqlState: PostgresErrorCodes.UniqueViolation
                } postgres
                && ConflictingNameDetail.Match(postgres.Detail ?? "") is { Success: true } match
            )
            {
                name = match.Groups[1].Value;
                return true;
            }
        }

        name = "";
        return false;
    }

    public static async Task<string> ConflictDetail(IQuerySession session, string name)
    {
        var holder = await session
            .Query<CapabilityIndex.Model>()
            .Where(x => x.Name == name)
            .FirstOrDefaultAsync();

        return holder is null
            ? $"Name \"{name}\" is already held."
            : HeldMessage(name, holder.Id);
    }

    static string HeldMessage(string name, Guid holderId) =>
        $"Name \"{name}\" is already held by capability {holderId}.";
}
