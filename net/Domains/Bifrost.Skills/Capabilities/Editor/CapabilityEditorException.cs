namespace Bifrost.Capabilities.Editor;

public sealed class CapabilityEditorException(string detail, Exception? inner = null)
    : Exception(detail, inner);
