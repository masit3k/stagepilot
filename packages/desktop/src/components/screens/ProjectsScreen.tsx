import { Card, CardBody, CardHeader } from "../ui/Card";
import { Button } from "../ui/Button";
import { useAppStore } from "@/lib/store";

export function ProjectsScreen() {
  const projects = useAppStore((state) => state.projects);
  const selected = useAppStore((state) => state.selectedProjectId);
  const selectProject = useAppStore((state) => state.selectProject);
  const versions = useAppStore((state) => state.versions);

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Card>
        <CardHeader>Projects</CardHeader>
        <CardBody>
          <div className="space-y-2">
            {projects.map((project) => (
              <button
                key={project.id}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                  selected === project.id
                    ? "bg-blue-500 text-white"
                    : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                }`}
                onClick={() => selectProject(project.id)}
              >
                <div className="font-semibold">{project.id}</div>
                <div className="text-xs text-slate-300">{project.bandRef}</div>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>Selected project</CardHeader>
          <CardBody>
            {selected ? (
              <div className="space-y-2 text-sm">
                <div className="font-semibold text-slate-50">{selected}</div>
                <div className="text-slate-300">Recent versions</div>
                <div className="space-y-2">
                  {(versions[selected] ?? []).map((version) => (
                    <div
                      key={version.versionId}
                      className="rounded-md border border-slate-800 px-3 py-2"
                    >
                      <div className="text-xs text-slate-400">{version.generatedAt}</div>
                      <div className="text-sm text-slate-100">{version.pdfFileName}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400">Select a project.</div>
            )}
          </CardBody>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button>New project</Button>
          <Button variant="outline">Edit project</Button>
          <Button variant="outline">Generate PDF</Button>
          <Button variant="ghost">Open output folder</Button>
        </div>
      </div>
    </div>
  );
}
