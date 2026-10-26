using System.Text.Json.Nodes;

namespace Bifrost.WorkItems;

static class JsonObjectExtensions
{
    extension(JsonObject current)
    {
        public bool MatchesPartial(JsonObject expected)
        {
            return Matches(expected, current);

            static bool Matches(JsonNode expectedNode, JsonNode? currentNode)
            {
                if (expectedNode is JsonObject expectedObject)
                {
                    if (currentNode is not JsonObject currentObject)
                    {
                        return false;
                    }

                    foreach (var property in expectedObject)
                    {
                        currentObject.TryGetPropertyValue(property.Key, out var currentValue);
                        if (property.Value is null)
                        {
                            if (currentValue is not null)
                            {
                                return false;
                            }

                            continue;
                        }

                        if (!Matches(property.Value, currentValue))
                        {
                            return false;
                        }
                    }

                    return true;
                }

                return JsonNode.DeepEquals(expectedNode, currentNode);
            }
        }
    }
}
