import { Select } from "@base-ui/react/select";
import { useRealm } from "../../lib/realm";

export function RealmSelector() {
  const { currentRealm, setCurrentRealm, availableRealms, realmOptions, isLoading } = useRealm();
  const options =
    realmOptions.length > 0
      ? realmOptions
      : availableRealms.map((realmId) => ({ id: realmId, name: realmId }));
  const selectedRealm =
    currentRealm && availableRealms.includes(currentRealm)
      ? currentRealm
      : availableRealms[0] ?? "";
  const items = Object.fromEntries(options.map((option) => [option.id, option.name]));

  if (isLoading) {
    return (
      <div
        className="text-xs uppercase tracking-wider px-3 py-2"
        style={{ color: "var(--color-border)" }}
      >
        Loading realms...
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div
        className="text-xs uppercase tracking-wider px-3 py-2"
        style={{ color: "var(--color-border)" }}
      >
        No realms available
      </div>
    );
  }

  return (
    <Select.Root
      items={items}
      value={selectedRealm || null}
      onValueChange={(value) => {
        if (typeof value === "string" && value) {
          setCurrentRealm(value);
        }
      }}
    >
      <Select.Trigger
        id="realm-select"
        aria-label="Realm"
        className="relative px-3 py-2 pr-8 text-xs font-bold uppercase tracking-wider appearance-none cursor-pointer"
        style={{
          backgroundColor: "var(--color-bg)",
          border: "2px solid var(--color-border)",
          color: "var(--color-text)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <Select.Value placeholder="Select realm" />
        <Select.Icon
          data-testid="realm-select-arrow"
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs"
          style={{ color: "var(--color-border)" }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner sideOffset={8} align="end">
          <Select.Popup
            className="min-w-[200px]"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "2px solid var(--color-border)",
              boxShadow: "var(--shadow-soft)",
            }}
          >
            <Select.List>
              {options.map((realm) => (
                <Select.Item
                  key={realm.id}
                  value={realm.id}
                  onClick={() => {
                    setCurrentRealm(realm.id);
                  }}
                  className="px-3 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  <Select.ItemText>{realm.name}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
