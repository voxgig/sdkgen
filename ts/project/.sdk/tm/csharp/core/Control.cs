// ProjectName SDK - per-call control block.

namespace ProjectNameSdk;

public class Control
{
    public bool? Throw;
    public Exception? Err;
    public Dictionary<string, object?>? Explain;
    public string Actor = "";
    public Dictionary<string, object?>? Paging;
    // Set by an entity's binary handle: the slot, the direction its bytes
    // move, and the bytes a read leaves.
    public Dictionary<string, object?>? Transfer;
}
