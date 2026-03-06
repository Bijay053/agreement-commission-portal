import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, FileText, File, Clock, Eye, Download, X, ShieldCheck } from "lucide-react";
import { format, parseISO } from "date-fns";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SecureViewer({ doc, userEmail, onClose }: { doc: any; userEmail: string; onClose: () => void }) {
  const isPdf = doc.mimeType === "application/pdf";
  const now = format(new Date(), "dd MMM yyyy HH:mm");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    const loadDocument = async () => {
      try {
        const res = await fetch(`/api/documents/${doc.id}/view`, { credentials: "include" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: "Access denied" }));
          setLoadError(err.message || "Failed to load document");
          return;
        }
        const blob = await res.blob();
        if (!revoked) {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        }
      } catch {
        setLoadError("Failed to load document");
      }
    };
    loadDocument();
    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [doc.id]);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && (e.key === "s" || e.key === "S" || e.key === "p" || e.key === "P")) ||
        (e.metaKey && (e.key === "s" || e.key === "S" || e.key === "p" || e.key === "P")) ||
        e.key === "PrintScreen"
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const handleBeforePrint = (e: Event) => e.preventDefault();

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("beforeprint", handleBeforePrint);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("beforeprint", handleBeforePrint);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col" data-testid="secure-viewer-overlay">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-700 shrink-0">
        <div className="flex items-center gap-2 text-white">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium">Secure Document Viewer</span>
          <span className="text-xs text-zinc-400 ml-2">{doc.originalFilename} (v{doc.versionNo})</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-zinc-700"
          data-testid="button-close-viewer"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 relative overflow-hidden select-none" style={{ userSelect: "none", WebkitUserSelect: "none" }}>
        {loadError ? (
          <div className="flex flex-col items-center justify-center h-full text-white">
            <ShieldCheck className="w-16 h-16 text-red-500 mb-4" />
            <p className="text-lg font-medium">Access Denied</p>
            <p className="text-sm text-zinc-400 mt-1">{loadError}</p>
          </div>
        ) : !blobUrl ? (
          <div className="flex flex-col items-center justify-center h-full text-white">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mb-4" />
            <p className="text-sm text-zinc-400">Loading secure document...</p>
          </div>
        ) : isPdf ? (
          <iframe
            src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
            className="w-full h-full border-0"
            style={{ pointerEvents: "auto" }}
            title={doc.originalFilename}
            data-testid="secure-viewer-iframe"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white">
            <File className="w-16 h-16 text-zinc-500 mb-4" />
            <p className="text-lg font-medium">{doc.originalFilename}</p>
            <p className="text-sm text-zinc-400 mt-1">{formatFileSize(doc.sizeBytes)}</p>
            <p className="text-xs text-zinc-500 mt-4">This file type cannot be previewed in the browser.</p>
            <p className="text-xs text-zinc-500">Use the download button if you have permission.</p>
          </div>
        )}

        <div
          className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden"
          style={{ zIndex: 10 }}
        >
          <div className="w-full h-full relative">
            {Array.from({ length: 6 }).map((_, row) =>
              Array.from({ length: 4 }).map((_, col) => (
                <div
                  key={`${row}-${col}`}
                  className="absolute text-white/[0.06] select-none"
                  style={{
                    top: `${15 + row * 16}%`,
                    left: `${5 + col * 25}%`,
                    transform: "rotate(-30deg)",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                >
                  <div>Study Info Centre - Confidential</div>
                  <div>{userEmail}</div>
                  <div>{now}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DocumentsTab({ agreementId }: { agreementId: number }) {
  const { hasPermission, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canUpload = hasPermission("document.upload");
  const canView = hasPermission("document.view_in_portal");
  const canDownload = hasPermission("document.download");
  const [showDialog, setShowDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewingDoc, setViewingDoc] = useState<any>(null);

  const { data: documents, isLoading } = useQuery<any[]>({
    queryKey: ["/api/agreements", agreementId, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/agreements/${agreementId}/documents`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (note) formData.append("note", note);

      const res = await fetch(`/api/agreements/${agreementId}/documents`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/agreements", agreementId, "documents"] });
      setShowDialog(false);
      setNote("");
      toast({ title: "Document uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (doc: any) => {
    const link = document.createElement("a");
    link.href = `/api/documents/${doc.id}/download`;
    link.download = doc.originalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) return <div className="space-y-3">{Array.from({length: 2}).map((_,i) => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Agreement Documents</h3>
        {canUpload && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-upload-document">
                <Upload className="w-4 h-4 mr-1" /> Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>File (PDF or DOCX, max 50MB)</Label>
                  <Input type="file" ref={fileRef} accept=".pdf,.doc,.docx" className="mt-1" data-testid="input-file-upload" />
                </div>
                <div>
                  <Label>Upload Note</Label>
                  <Input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g., Updated commission schedule" data-testid="input-upload-note" />
                </div>
                <Button onClick={handleUpload} className="w-full" disabled={uploading} data-testid="button-submit-upload">
                  {uploading ? "Uploading..." : "Upload Document"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {documents && documents.length > 0 ? (
        <div className="space-y-2">
          {documents.map((doc: any) => (
            <Card key={doc.id} data-testid={`card-document-${doc.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-md bg-primary/10">
                    <File className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{doc.originalFilename}</p>
                      <Badge variant="outline">v{doc.versionNo}</Badge>
                      <Badge variant={doc.status === "active" ? "default" : "secondary"}>
                        {doc.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>{formatFileSize(doc.sizeBytes)}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {doc.createdAt ? format(parseISO(doc.createdAt), "dd MMM yyyy HH:mm") : "Unknown"}
                      </span>
                      {doc.uploadNote && <span>{doc.uploadNote}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {canView && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Secure View"
                        data-testid={`button-view-document-${doc.id}`}
                        onClick={() => setViewingDoc(doc)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    {canDownload && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Download"
                        data-testid={`button-download-document-${doc.id}`}
                        onClick={() => handleDownload(doc)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No documents uploaded</p>
          </CardContent>
        </Card>
      )}

      {viewingDoc && (
        <SecureViewer
          doc={viewingDoc}
          userEmail={user?.user?.email || "Unknown"}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </div>
  );
}
