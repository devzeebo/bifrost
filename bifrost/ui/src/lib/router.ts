import { navigate as vikeNavigate } from "vike/client/router";

const UI_PREFIX = "/ui";

export function toUIPath(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (
    normalizedPath === UI_PREFIX ||
    normalizedPath.startsWith(`${UI_PREFIX}/`)
  ) {
    return normalizedPath;
  }

  if (normalizedPath === "/") {
    return `${UI_PREFIX}/`;
  }

  return `${UI_PREFIX}${normalizedPath}`;
}

export function navigate(path: string): void {
  void vikeNavigate(toUIPath(path));
}
