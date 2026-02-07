import { ProjectsScreen } from "./components/screens/ProjectsScreen";
import { EditorScreen } from "./components/screens/EditorScreen";
import { PreviewScreen } from "./components/screens/PreviewScreen";
import { Button } from "./components/ui/Button";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-lg font-semibold">StagePilot Desktop</div>
            <div className="text-xs text-slate-400">Project orchestration and PDF preview</div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost">Projects</Button>
            <Button variant="ghost">Editor</Button>
            <Button variant="ghost">Preview</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-8">
        <ProjectsScreen />
        <EditorScreen />
        <PreviewScreen />
      </main>
    </div>
  );
}
