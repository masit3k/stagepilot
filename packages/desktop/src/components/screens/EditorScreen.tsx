import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { useAppStore } from "@/lib/store";
import type { ProjectSummary } from "@/lib/types";

const schema = z.object({
  id: z.string().min(1, "Project ID is required"),
  bandRef: z.string().min(1, "Band reference is required"),
  purpose: z.enum(["event", "generic"]),
  documentDate: z.string().min(1, "Document date is required"),
  eventDate: z.string().optional(),
  eventVenue: z.string().optional(),
  title: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function EditorScreen() {
  const selectedProject = useAppStore((state) =>
    state.projects.find((project) => project.id === state.selectedProjectId)
  );
  const upsertProject = useAppStore((state) => state.upsertProject);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      id: selectedProject?.id ?? "",
      bandRef: selectedProject?.bandRef ?? "",
      purpose: selectedProject?.purpose ?? "event",
      documentDate: selectedProject?.documentDate ?? "",
      eventDate: selectedProject?.eventDate ?? "",
      eventVenue: selectedProject?.eventVenue ?? "",
      title: selectedProject?.title ?? "",
    },
  });

  const purpose = form.watch("purpose");

  const onSubmit = (values: FormValues) => {
    const payload: ProjectSummary = {
      id: values.id,
      bandRef: values.bandRef,
      purpose: values.purpose,
      documentDate: values.documentDate,
      eventDate: values.purpose === "event" ? values.eventDate : undefined,
      eventVenue: values.purpose === "event" ? values.eventVenue : undefined,
      title: values.title,
    };
    upsertProject(payload);
  };

  return (
    <Card>
      <CardHeader>Project editor</CardHeader>
      <CardBody>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>Project ID</span>
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
                {...form.register("id")}
              />
              <span className="text-xs text-rose-400">{form.formState.errors.id?.message}</span>
            </label>
            <label className="space-y-1 text-sm">
              <span>Band reference</span>
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
                {...form.register("bandRef")}
              />
              <span className="text-xs text-rose-400">
                {form.formState.errors.bandRef?.message}
              </span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>Purpose</span>
              <select
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
                {...form.register("purpose")}
              >
                <option value="event">Event</option>
                <option value="generic">Generic</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Document date</span>
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
                {...form.register("documentDate")}
              />
              <span className="text-xs text-rose-400">
                {form.formState.errors.documentDate?.message}
              </span>
            </label>
          </div>

          {purpose === "event" && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span>Event date</span>
                <input
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
                  {...form.register("eventDate")}
                />
                <span className="text-xs text-rose-400">
                  {form.formState.errors.eventDate?.message}
                </span>
              </label>
              <label className="space-y-1 text-sm">
                <span>Event venue</span>
                <input
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
                  {...form.register("eventVenue")}
                />
                <span className="text-xs text-rose-400">
                  {form.formState.errors.eventVenue?.message}
                </span>
              </label>
            </div>
          )}

          <label className="space-y-1 text-sm">
            <span>Title</span>
            <input
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
              {...form.register("title")}
            />
          </label>

          <div className="flex items-center gap-3">
            <Button type="submit">Save project</Button>
            <Button variant="outline" type="button">
              Generate PDF
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
