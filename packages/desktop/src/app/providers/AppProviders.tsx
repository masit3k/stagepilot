import { StrictMode, type ReactNode } from "react";

function AppProviders({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}

export default AppProviders;
