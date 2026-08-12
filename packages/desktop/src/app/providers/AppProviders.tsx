import { type ReactNode, StrictMode } from "react";
import { ToastProvider } from "../../components/ui/toast/ToastProvider";
import { ThemeProvider } from "./ThemeProvider";

function AppProviders({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <ThemeProvider>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </StrictMode>
  );
}

export default AppProviders;
