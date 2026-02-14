import type { ReactElement } from "react";
import AppLegacy from "../legacy/AppLegacy";

export type AppRoute = {
  path: string;
  element: ReactElement;
};

export const routes: AppRoute[] = [{ path: "*", element: <AppLegacy /> }];
