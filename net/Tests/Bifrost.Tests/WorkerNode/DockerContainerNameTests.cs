using Bifrost.WorkerNode;
using Shouldly;

namespace Bifrost.Tests.WorkerNode;

public class DockerContainerNameTests
{
    [Fact]
    public void for_run_is_stable_and_unique_per_run()
    {
        var runId = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        DockerContainerName.ForRun(runId).ShouldBe("bifrost-run-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    }

    [Fact]
    public void try_read_from_arguments_finds_name()
    {
        string[] args =
        [
            "run",
            "--rm",
            "--name",
            "bifrost-run-1",
            "-v",
            "/tmp:/workspace",
            "bifrost/node",
        ];
        DockerContainerName.TryReadFromArguments(args).ShouldBe("bifrost-run-1");
    }

    [Fact]
    public void is_docker_executable_matches_leaf_name()
    {
        DockerContainerName.IsDockerExecutable("docker").ShouldBeTrue();
        DockerContainerName.IsDockerExecutable("/usr/bin/docker").ShouldBeTrue();
        DockerContainerName.IsDockerExecutable("docker.exe").ShouldBeTrue();
        DockerContainerName.IsDockerExecutable("podman").ShouldBeFalse();
    }
}
