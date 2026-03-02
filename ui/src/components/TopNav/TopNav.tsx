"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { Switch } from "@base-ui/react/switch";
import { navigate, toUIPath } from "@/lib/router";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import "./TopNav.css";

const NAV_LINKS = [
  { href: "/ui/", label: "Dashboard", color: "#ef4444" },
  { href: "/ui/runes", label: "Runes", color: "#f59e0b" },
  { href: "/ui/realms", label: "Realms", color: "#22c55e" },
  { href: "/ui/accounts", label: "Accounts", color: "#3b82f6" },
];

const FALLBACK_INDICATOR_GRADIENT =
  "linear-gradient(90deg, #ef4444 0%, #ef4444 25%, #f59e0b 25%, #f59e0b 50%, #22c55e 50%, #22c55e 75%, #3b82f6 75%, #3b82f6 100%)";

const EDGE_PADDING_PX = 10;

type LabelRange = {
  left: number;
  right: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const buildIndicatorGradient = (navWidth: number, labelRanges: LabelRange[]): string => {
  if (labelRanges.length !== NAV_LINKS.length || navWidth <= 0) {
    return FALLBACK_INDICATOR_GRADIENT;
  }

  const segments = labelRanges.map((range, index) => {
    const start = clamp(range.left - EDGE_PADDING_PX, 0, navWidth);
    const end = clamp(range.right + EDGE_PADDING_PX, 0, navWidth);

    return {
      color: NAV_LINKS[index].color,
      start,
      end: Math.max(end, start),
    };
  });

  const firstSegment = segments[0];
  if (!firstSegment) {
    return FALLBACK_INDICATOR_GRADIENT;
  }

  const colorStops: string[] = [];
  let cursor = 0;

  colorStops.push(`${firstSegment.color} ${cursor}px`);

  for (let index = 0; index < segments.length; index += 1) {
    const current = segments[index];
    if (!current) {
      continue;
    }

    const start = Math.max(current.start, cursor);
    if (start > cursor) {
      colorStops.push(`${current.color} ${start}px`);
      cursor = start;
    }

    const end = Math.max(current.end, cursor);
    colorStops.push(`${current.color} ${end}px`);
    cursor = end;

    const next = segments[index + 1];
    if (next) {
      const blendEnd = Math.max(next.start, cursor);
      colorStops.push(`${next.color} ${blendEnd}px`);
      cursor = blendEnd;
    }
  }

  if (cursor < navWidth) {
    const lastColor = segments[segments.length - 1]?.color ?? NAV_LINKS[NAV_LINKS.length - 1]?.color;
    if (lastColor) {
      colorStops.push(`${lastColor} ${navWidth}px`);
    }
  }

  return `linear-gradient(90deg, ${colorStops.join(", ")})`;
};

export function TopNav() {
  const { username, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties>({});

  useEffect(() => {
    const updateIndicator = () => {
      const navElement = navRef.current;
      const activeLabel = labelRefs.current[activeIndex];

      if (!navElement || !activeLabel) {
        return;
      }

      const navRect = navElement.getBoundingClientRect();
      const labelRect = activeLabel.getBoundingClientRect();

      const labelRanges: LabelRange[] = [];
      for (let index = 0; index < NAV_LINKS.length; index += 1) {
        const label = labelRefs.current[index];
        if (!label) {
          return;
        }

        const rect = label.getBoundingClientRect();
        labelRanges.push({
          left: rect.left - navRect.left,
          right: rect.right - navRect.left,
        });
      }

      const unclampedLeft = labelRect.left - navRect.left - EDGE_PADDING_PX;
      const left = clamp(unclampedLeft, 0, navRect.width);
      const maxWidth = Math.max(navRect.width - left, 0);
      const width = Math.min(labelRect.width + EDGE_PADDING_PX * 2, maxWidth);
      const gradient = buildIndicatorGradient(navRect.width, labelRanges);

      setIndicatorStyle({
        transform: `translateX(${left}px)`,
        width: `${width}px`,
        backgroundImage: gradient,
        backgroundSize: `${navRect.width}px 100%`,
        backgroundPosition: `-${left}px 0`,
      });
    };

    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeIndex]);

  // Determine active link based on current path
  useEffect(() => {
    const path = window.location.pathname;
    const index = NAV_LINKS.findIndex(
      (link) => {
        const uiHref = toUIPath(link.href);
        return (
          uiHref === path ||
          (uiHref !== toUIPath("/") && path.startsWith(uiHref))
        );
      }
    );
    setActiveIndex(index >= 0 ? index : 0);
  }, []);

  const handleNavClick = (href: string, index: number) => {
    setActiveIndex(index);
    navigate(href);
  };

  const handleLogout = async () => {
    setIsAccountMenuOpen(false);
    await logout();
    window.location.assign(toUIPath("/login"));
  };

  return (
    <nav className="top-nav">
      {/* Logo */}
      <a href="/ui/" className="top-nav__logo" onClick={(e) => { e.preventDefault(); navigate("/ui/"); }}>
        <span className="top-nav__logo-text">Bifrost</span>
      </a>

      {/* Navigation Links with Rainbow Indicator */}
      <div className="top-nav__links-container" ref={navRef}>
        <div
          className="top-nav__indicator"
          style={indicatorStyle}
        />
        
        {/* Nav links */}
        {NAV_LINKS.map((link, index) => (
          <button
            key={link.href}
            type="button"
            className={`top-nav__link ${activeIndex === index ? "top-nav__link--active" : ""}`}
            onClick={() => handleNavClick(link.href, index)}
            style={{ "--link-color": link.color } as CSSProperties}
          >
            <span
              className="top-nav__link-label"
              ref={(element) => {
                labelRefs.current[index] = element;
              }}
            >
              {link.label}
            </span>
          </button>
        ))}
      </div>

      {/* Right side: Theme toggle + Account badge */}
      <div className="top-nav__right">
        <Switch.Root
          checked={isDark}
          onCheckedChange={(checked) => {
            if (checked !== isDark) {
              toggleTheme();
            }
          }}
          className="top-nav__theme-toggle"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          <Switch.Thumb className="sr-only" />
          {isDark ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </Switch.Root>

        <Menu.Root open={isAccountMenuOpen} onOpenChange={setIsAccountMenuOpen}>
          <Menu.Trigger className="top-nav__account" aria-label="User menu">
            <span className="top-nav__account-badge">
              {username ? username.charAt(0).toUpperCase() : "?"}
            </span>
            <span className="top-nav__account-name">{username || "Guest"}</span>
            <span className="top-nav__account-caret" aria-hidden="true">
              ▾
            </span>
          </Menu.Trigger>

          <Menu.Portal>
            <Menu.Positioner sideOffset={8} align="end">
              <Menu.Popup className="top-nav__account-dropdown" aria-label="User menu options">
                <Menu.Item
                  className="top-nav__account-dropdown-item"
                  onClick={() => {
                    void handleLogout();
                  }}
                >
                  Logout
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </nav>
  );
}
