import { type ReactNode, StrictMode } from "react";
import { ToastProvider } from "../../components/ui/toast/ToastProvider";

function AppProviders({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <ToastProvider>{children}</ToastProvider>
    </StrictMode>
  );
}

export default AppProviders;
