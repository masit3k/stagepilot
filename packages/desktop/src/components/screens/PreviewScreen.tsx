import { Button } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";

export function PreviewScreen() {
  return (
    <Card>
      <CardHeader>Preview</CardHeader>
      <CardBody>
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="flex min-h-[420px] items-center justify-center rounded-md border border-dashed border-slate-700 bg-slate-950 text-sm text-slate-400">
            PDF preview will appear here (pdf.js integration).
          </div>
          <div className="space-y-4">
            <div className="rounded-md border border-slate-800 bg-slate-950 p-3 text-sm">
              <div className="text-slate-400">Version</div>
              <div className="text-slate-100">20250110-120000-123</div>
              <div className="mt-2 text-slate-400">PDF file</div>
              <div className="text-slate-100">BK_Inputlist_Stageplan_2025.pdf</div>
            </div>
            <div className="space-y-2">
              <Button className="w-full">Open PDF</Button>
              <Button className="w-full" variant="outline">
                Open folder
              </Button>
              <Button className="w-full" variant="ghost">
                Copy PDF path
              </Button>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
