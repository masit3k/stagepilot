import { useCallback, useEffect, useRef, useState } from "react";
import type { NavigationGuard } from "../types";

function getCurrentPath() {
  return window.location.pathname || "/";
}

export function resolvePopstateNavigation(params: { targetPath: string; currentPath: string; isDirty: boolean }) {
  if (params.isDirty) {
    return { restorePath: params.currentPath, pendingNavigation: params.targetPath, applyTarget: false };
  }
  return { restorePath: null, pendingNavigation: null, applyTarget: true };
}

export function useAppNavigation() {
  const [pathname, setPathname] = useState(getCurrentPath());
  const [search, setSearch] = useState(window.location.search || "");
  const pathnameRef = useRef(pathname);
  const guardRef = useRef<NavigationGuard | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const registerNavigationGuard = useCallback((guard: NavigationGuard | null) => {
    guardRef.current = guard;
  }, []);

  const navigateImmediate = useCallback((path: string, replace = false) => {
    if (replace) window.history.replaceState({}, "", path);
    else window.history.pushState({}, "", path);
    setPathname(window.location.pathname);
    setSearch(window.location.search || "");
  }, []);

  const navigate = useCallback((path: string) => {
    if (path === pathnameRef.current) return;
    const guard = guardRef.current;
    if (guard?.isDirty()) {
      setPendingNavigation(path);
      return;
    }
    navigateImmediate(path);
  }, [navigateImmediate]);

  useEffect(() => {
    const h = () => {
      const targetPath = getCurrentPath();
      const resolved = resolvePopstateNavigation({
        targetPath,
        currentPath: pathnameRef.current,
        isDirty: Boolean(guardRef.current?.isDirty()),
      });
      if (!resolved.applyTarget) {
        window.history.pushState({}, "", resolved.restorePath ?? pathnameRef.current);
        setPendingNavigation(resolved.pendingNavigation);
        return;
      }
      setPathname(targetPath);
      setSearch(window.location.search || "");
    };
    window.addEventListener("popstate", h);
    return () => window.removeEventListener("popstate", h);
  }, []);

  const stayOnPage = useCallback(() => setPendingNavigation(null), []);
  const exitWithoutSaving = useCallback(() => {
    guardRef.current?.discard?.();
    const path = pendingNavigation;
    setPendingNavigation(null);
    if (path) navigateImmediate(path);
  }, [navigateImmediate, pendingNavigation]);

  const saveAndExit = useCallback(async () => {
    await guardRef.current?.save();
    const path = pendingNavigation;
    setPendingNavigation(null);
    if (path) navigateImmediate(path);
  }, [navigateImmediate, pendingNavigation]);

  return {
    pathname,
    search,
    navigate,
    navigateImmediate,
    registerNavigationGuard,
    pendingNavigation,
    stayOnPage,
    exitWithoutSaving,
    saveAndExit,
  };
}
