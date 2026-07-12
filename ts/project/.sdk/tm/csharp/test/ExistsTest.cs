// ProjectName SDK exists test.

using Xunit;

using ProjectNameSdk;

namespace ProjectNameSdk.Test;

public class ExistsTest
{
    [Fact]
    public void TestMode()
    {
        var testsdk = ProjectNameSDK.TestSDK(null, null);
        Assert.NotNull(testsdk);
    }
}
