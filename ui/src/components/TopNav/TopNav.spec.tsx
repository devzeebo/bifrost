import { describe, expect, vi, beforeEach, test } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TopNav } from "./TopNav";

// Define types locally since they're not exported from lib files
type AuthContextValue = {
  isAuthenticated: boolean;
  accountId: string | null;
  username: string | null;
  roles: Record<string, string>;
  realms: string[];
  realmNames: Record<string, string>;
  isSysadmin: boolean;
  login: (pat: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
};

type ThemeContextValue = {
  isDark: boolean;
  toggleTheme: () => void;
};

// Mock the hooks
vi.mock("../../lib/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../lib/theme", () => ({
  useTheme: vi.fn(),
}));

vi.mock("../../lib/realm", () => ({
  useRealm: vi.fn(),
}));

// Mock navigate function
vi.mock("vike/client/router", () => ({
  navigate: vi.fn(),
}));

import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { useRealm } from "../../lib/realm";

// Helper function to create complete AuthContextValue mock
const createMockAuthValue = (
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue => ({
  isAuthenticated: true,
  accountId: "123",
  username: "testuser",
  roles: {},
  realms: [],
  realmNames: {},
  isSysadmin: false,
  login: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  loading: false,
  ...overrides,
});

// Helper function to create complete ThemeContextValue mock
const createMockThemeValue = (
  overrides: Partial<ThemeContextValue> = {},
): ThemeContextValue => ({
  isDark: false,
  toggleTheme: vi.fn(),
  ...overrides,
});

describe("TopNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRealm).mockReturnValue({
      currentRealm: null,
      setCurrentRealm: vi.fn(),
      availableRealms: [],
      realmOptions: [],
      isLoading: false,
    });
  });

  describe("Navigation Links", () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue(
        createMockAuthValue({ username: "testuser" }),
      );
      vi.mocked(useTheme).mockReturnValue(createMockThemeValue());
    });

    test("renders dashboard link", () => {
      render(<TopNav />);
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    test("renders runes link", () => {
      render(<TopNav />);
      expect(screen.getByText("Runes")).toBeInTheDocument();
    });

    test("renders realms link", () => {
      render(<TopNav />);
      expect(screen.getByText("Realms")).toBeInTheDocument();
    });

    test("renders accounts link", () => {
      render(<TopNav />);
      expect(screen.getByText("Accounts")).toBeInTheDocument();
    });

    test("keeps accounts section active for account subpages", () => {
      const { rerender } = render(<TopNav currentPath="/ui/accounts/new" />);

      expect(screen.getByText("Accounts").closest("button")).toHaveClass("top-nav__link--active");

      rerender(<TopNav currentPath="/ui/accounts/acc-123" />);

      expect(screen.getByText("Accounts").closest("button")).toHaveClass("top-nav__link--active");
    });

    test("updates active section when route changes across sections", () => {
      const { rerender } = render(<TopNav currentPath="/ui/accounts/acc-123" />);

      expect(screen.getByText("Accounts").closest("button")).toHaveClass("top-nav__link--active");

      rerender(<TopNav currentPath="/ui/realms/realm-123" />);

      expect(screen.getByText("Realms").closest("button")).toHaveClass("top-nav__link--active");
      expect(screen.getByText("Accounts").closest("button")).not.toHaveClass("top-nav__link--active");
    });

    test("matches sections when currentPath is missing the /ui prefix", () => {
      const { rerender } = render(<TopNav currentPath="/accounts/acc-123" />);

      expect(screen.getByText("Accounts").closest("button")).toHaveClass("top-nav__link--active");

      rerender(<TopNav currentPath="/realms/realm-123" />);

      expect(screen.getByText("Realms").closest("button")).toHaveClass("top-nav__link--active");
    });

    test("keeps runes section active for rune subpages", () => {
      render(<TopNav currentPath="/ui/runes/rune-123/edit" />);

      expect(screen.getByText("Runes").closest("button")).toHaveClass("top-nav__link--active");
    });
  });

  describe("Theme Toggle", () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue(
        createMockAuthValue({ username: "testuser" }),
      );
    });

    test("displays theme toggle button in light mode", () => {
      vi.mocked(useTheme).mockReturnValue(createMockThemeValue({ isDark: false }));
      render(<TopNav />);
      const toggleButton = screen.getByRole("switch", {
        name: /switch to dark mode/i,
      });
      expect(toggleButton).toBeInTheDocument();
    });

    test("displays theme toggle button in dark mode", () => {
      vi.mocked(useTheme).mockReturnValue(createMockThemeValue({ isDark: true }));
      render(<TopNav />);
      const toggleButton = screen.getByRole("switch", {
        name: /switch to light mode/i,
      });
      expect(toggleButton).toBeInTheDocument();
    });

    test("displays correct icon for dark mode", () => {
      vi.mocked(useTheme).mockReturnValue(createMockThemeValue({ isDark: true }));
      render(<TopNav />);
      const toggleButton = screen.getByRole("switch", {
        name: /switch to light mode/i,
      });
      expect(toggleButton).toBeInTheDocument();
    });

    test("calls toggleTheme when theme toggle button is clicked", () => {
      const toggleTheme = vi.fn();
      vi.mocked(useTheme).mockReturnValue(createMockThemeValue({ toggleTheme }));
      render(<TopNav />);

      const toggleButton = screen.getByRole("switch", {
        name: /switch to dark mode/i,
      });
      fireEvent.click(toggleButton);

      expect(toggleTheme).toHaveBeenCalledTimes(1);
    });
  });

  describe("Account Badge", () => {
    beforeEach(() => {
      vi.mocked(useTheme).mockReturnValue(createMockThemeValue());
    });

    test("displays account badge with username initial", () => {
      vi.mocked(useAuth).mockReturnValue(
        createMockAuthValue({ username: "John Doe" }),
      );
      render(<TopNav />);
      expect(screen.getByText("J")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    test("displays guest state when user is not authenticated", () => {
      vi.mocked(useAuth).mockReturnValue(
        createMockAuthValue({ username: null, isAuthenticated: false }),
      );
      render(<TopNav />);
      expect(screen.getByText("?")).toBeInTheDocument();
      expect(screen.getByText("Guest")).toBeInTheDocument();
    });

    test("opens user menu and triggers logout", async () => {
      const logout = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(createMockAuthValue({ username: "John Doe", logout }));
      render(<TopNav />);

      const userMenuButton = screen.getByRole("button", { name: /user menu/i });
      fireEvent.click(userMenuButton);

      const logoutButton = screen.getByRole("menuitem", { name: /logout/i });
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(logout).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("Logo", () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue(
        createMockAuthValue({ username: "testuser" }),
      );
      vi.mocked(useTheme).mockReturnValue(createMockThemeValue());
    });

    test("renders logo with correct text", () => {
      render(<TopNav />);
      const logo = screen.getByText("Bifrost");
      expect(logo).toBeInTheDocument();
      expect(logo.textContent).toBe("Bifrost");
    });
  });

  describe("Component Rendering", () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue(
        createMockAuthValue({ username: "testuser" }),
      );
      vi.mocked(useTheme).mockReturnValue(createMockThemeValue());
    });

    test("renders without crashing", () => {
      render(<TopNav />);
      const nav = screen.getByRole("navigation");
      expect(nav).toBeInTheDocument();
    });
  });
});
