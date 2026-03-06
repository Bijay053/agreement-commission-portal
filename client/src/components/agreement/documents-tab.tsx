import { useState, useRef } from "react";
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
import { Upload, FileText, File, Clock, User, Eye, Download } from "lucide-react";
import { format, parseISO } from "date-fns";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsTab({ agreementId }: { agreementId: number }) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canUpload = hasPermission("document.upload");
  const [showDialog, setShowDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
                    <Button
                      size="icon"
                      variant="ghost"
                      data-testid={`button-view-document-${doc.id}`}
                      onClick={() => {
                        const isPdf = doc.mimeType === "application/pdf";
                        window.open(`/api/documents/${doc.id}/download?inline=${isPdf ? "true" : "false"}`, "_blank");
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      data-testid={`button-download-document-${doc.id}`}
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = `/api/documents/${doc.id}/download`;
                        link.download = doc.originalFilename;
                        link.click();
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
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
    </div>
  );
}
