import type { ReactElement } from "react";
import AppShell from "../shell/AppShell";

export type AppRoute = {
  path: string;
  element: ReactElement;
};

export const routes: AppRoute[] = [{ path: "*", element: <AppShell /> }];
