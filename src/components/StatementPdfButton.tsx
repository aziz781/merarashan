import { useState } from "react";
import { FileText, FileDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function StatementPdfButton({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" className="w-full mt-3" onClick={() => setOpen(true)}>
        <FileText className="w-4 h-4 mr-2" />
        View Statement
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl w-[95vw] h-[85vh] p-0 flex flex-col">
          <DialogHeader className="px-4 py-3 border-b">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DialogTitle className="truncate text-base">{title}</DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}`;
                    const win = window.open(url, "_blank", "noopener,noreferrer");
                    if (!win) {
                      window.open(viewerUrl, "_blank", "noopener,noreferrer");
                      return;
                    }
                    window.setTimeout(() => {
                      if (win.closed) {
                        window.open(viewerUrl, "_blank", "noopener,noreferrer");
                      }
                    }, 1500);
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in new tab
                </Button>
                <Button asChild type="button" variant="default" size="sm">
                  <a href={url} download={`${title}.pdf`} target="_blank" rel="noopener noreferrer">
                    <FileDown className="w-4 h-4 mr-2" />
                    Download PDF
                  </a>
                </Button>
              </div>
            </div>
          </DialogHeader>
          <iframe
            src={`https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(url)}`}
            title={title}
            className="flex-1 w-full border-0 bg-muted"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
