import AppProviders from "./providers/AppProviders";
import { AppRouter } from "./router/Router";
import { ModalHost } from "../components/ui/Modal";

function Root() {
  return (
    <AppProviders>
      <AppRouter />
      <ModalHost />
    </AppProviders>
  );
}

export default Root;
