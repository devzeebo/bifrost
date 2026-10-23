namespace Bifrost.Tests.Rpc;

static class Waiting
{
    public static async Task Until(Func<bool> condition, TimeSpan? timeout = null)
    {
        var deadline = DateTime.UtcNow + (timeout ?? TimeSpan.FromSeconds(2));
        while (!condition())
        {
            if (DateTime.UtcNow >= deadline)
            {
                throw new TimeoutException("Condition was not satisfied in time.");
            }

            await Task.Delay(10);
        }
    }
}
