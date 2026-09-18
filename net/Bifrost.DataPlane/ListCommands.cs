namespace Bifrost;

public static class ListCommandsHandler
{
    public static ListCommandsApi.Response Handle(ListCommandsApi.Query _) =>
        new()
        {
            Commands =
            [
                "POST /define-relationship-type",
                "POST /change-relationship-type-words",
                "POST /retire-relationship-type",
                "POST /create-work-item",
                "POST /replace-work-item-data",
                "POST /change-work-item-status",
                "POST /add-relationship",
                "POST /remove-relationship",
                "POST /delete-work-item",
            ],
            Queries =
            [
                "QUERY /list-relationship-types",
                "QUERY /get-relationship-type/{id}",
                "QUERY /list-work-items",
                "QUERY /get-work-item/{id}",
                "QUERY /commands",
            ],
        };
}
