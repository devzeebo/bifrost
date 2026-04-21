import { describe, expect, vi, beforeEach, test } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { RealmSelector } from "./RealmSelector";

// Define types locally since they're not exported from lib files
type RealmContextValue = {
  currentRealm: string | null;
  setCurrentRealm: (realm: string | null) => void;
  availableRealms: string[];
  realmOptions: Array<{ id: string; name: string }>;
  isLoading: boolean;
};

// Mock the useRealm hook
vi.mock("../../lib/realm", () => ({
  useRealm: vi.fn(),
}));

import { useRealm } from "../../lib/realm";

// Helper function to create complete RealmContextValue mock
const createMockRealmValue = (
  overrides: Partial<RealmContextValue> = {},
): RealmContextValue => ({
  currentRealm: "test-realm",
  setCurrentRealm: vi.fn(),
  availableRealms: ["test-realm", "other-realm"],
  realmOptions: [
    { id: "test-realm", name: "Test Realm" },
    { id: "other-realm", name: "Other Realm" },
  ],
  isLoading: false,
  ...overrides,
});

describe("RealmSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    test("shows loading message when isLoading is true", () => {
      vi.mocked(useRealm).mockReturnValue(
        createMockRealmValue({ isLoading: true }),
      );
      render(<RealmSelector />);
      expect(
        screen.getByText("Loading realms..."),
      ).toBeInTheDocument();
    });
  });

  describe("Component Rendering", () => {
    beforeEach(() => {
      vi.mocked(useRealm).mockReturnValue(
        createMockRealmValue({
          currentRealm: "test-realm",
          availableRealms: ["test-realm", "other-realm"],
        }),
      );
    });

    test("renders without crashing", () => {
      const { container } = render(<RealmSelector />);
      expect(container).toBeInTheDocument();
    });

    test("renders select with accessible realm label", () => {
      render(<RealmSelector />);
      expect(screen.getByLabelText("Realm")).toBeInTheDocument();
    });

    test("renders chevron indicator", () => {
      render(<RealmSelector />);
      expect(screen.getByTestId("realm-select-arrow")).toBeInTheDocument();
    });

    test("renders select element", () => {
      render(<RealmSelector />);
      expect(screen.getByLabelText("Realm")).toBeInTheDocument();
    });

    test("displays current realm name", () => {
      render(<RealmSelector />);
      expect(screen.getByText("Test Realm")).toBeInTheDocument();
    });
  });

  describe("Realm Selection", () => {
    test("displays all available realms as options", () => {
      vi.mocked(useRealm).mockReturnValue(
        createMockRealmValue({
          currentRealm: "test-realm",
          availableRealms: ["test-realm", "other-realm", "third-realm"],
          realmOptions: [
            { id: "test-realm", name: "Test Realm" },
            { id: "other-realm", name: "Other Realm" },
            { id: "third-realm", name: "Third Realm" },
          ],
        }),
      );
      render(<RealmSelector />);
      fireEvent.click(screen.getByLabelText("Realm"));
      const listbox = screen.getByRole("listbox");
      expect(within(listbox).getByText("Test Realm")).toBeInTheDocument();
      expect(within(listbox).getByText("Other Realm")).toBeInTheDocument();
      expect(within(listbox).getByText("Third Realm")).toBeInTheDocument();
    });

    test("calls setCurrentRealm when a different realm is selected", async () => {
      const mockSetCurrentRealm = vi.fn();
      vi.mocked(useRealm).mockReturnValue(
        createMockRealmValue({
          currentRealm: "test-realm",
          availableRealms: ["test-realm", "other-realm"],
          setCurrentRealm: mockSetCurrentRealm,
        }),
      );

      render(<RealmSelector />);
      fireEvent.click(screen.getByLabelText("Realm"));
      const listbox = screen.getByRole("listbox");
      fireEvent.click(within(listbox).getByRole("option", { name: "Other Realm" }));

      expect(mockSetCurrentRealm).toHaveBeenCalledWith("other-realm");
    });
  });

  describe("Empty Realm List", () => {
    test("renders with empty available realms", () => {
      vi.mocked(useRealm).mockReturnValue(
        createMockRealmValue({
          currentRealm: null,
          availableRealms: [],
          realmOptions: [],
        }),
      );

      const { container } = render(<RealmSelector />);
      expect(container).toBeInTheDocument();

      expect(screen.getByText("No realms available")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    test("handles null currentRealm", () => {
      vi.mocked(useRealm).mockReturnValue(
        createMockRealmValue({
          currentRealm: null,
          availableRealms: ["test-realm"],
        }),
      );

      render(<RealmSelector />);
      expect(screen.getByText("Test Realm")).toBeInTheDocument();
    });

    test("handles single available realm", () => {
      vi.mocked(useRealm).mockReturnValue(
        createMockRealmValue({
          currentRealm: "test-realm",
          availableRealms: ["test-realm"],
          realmOptions: [{ id: "test-realm", name: "Test Realm" }],
        }),
      );

      render(<RealmSelector />);
      fireEvent.click(screen.getByLabelText("Realm"));
      const listbox = screen.getByRole("listbox");
      expect(within(listbox).getByText("Test Realm")).toBeInTheDocument();
    });
  });
});
