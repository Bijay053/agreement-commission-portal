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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Upload, FileText, File, Clock, Eye, Download, Trash2, X, ShieldCheck, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { format, parseISO } from "date-fns";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface WatermarkInfo {
  userName: string;
  userEmail: string;
  userIp: string;
}

function PdfCanvasViewer({ pdfData, watermarkInfo }: { pdfData: ArrayBuffer; watermarkInfo: WatermarkInfo }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const watermarkCanvasRef = useRef<HTMLCanvasElement>(null);

  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    const loadPdf = async () => {
      try {
        const uint8 = new Uint8Array(pdfData);
        const loadingTask = pdfjsLib.getDocument({ data: uint8.slice(0) });
        loadingTask.onPassword = (callback: (password: string) => void, reason: number) => {
          const pwd = prompt(
            reason === 1
              ? "This PDF is password-protected. Enter the password:"
              : "Incorrect password. Try again:"
          );
          if (pwd) {
            callback(pwd);
          } else {
            setPdfError("Password required to view this document");
          }
        };
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setPdfError(null);
      } catch (err: any) {
        console.error("PDF load error:", err?.name, err?.message, err);
        if (err?.name === "PasswordException") {
          setPdfError("Password required to view this document");
        } else {
          setPdfError("Failed to load PDF");
        }
      }
    };
    loadPdf();
  }, [pdfData]);

  const renderPage = useCallback(async (pageNum: number, zoom: number) => {
    if (!pdfDoc || !canvasRef.current || !watermarkCanvasRef.current) return;
    setRendering(true);
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: zoom });

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const wCanvas = watermarkCanvasRef.current;
      wCanvas.width = viewport.width;
      wCanvas.height = viewport.height;

      try {
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (renderErr) {
        console.error("PDF page render error:", renderErr);
      }

      const wCtx = wCanvas.getContext("2d")!;
      wCtx.clearRect(0, 0, wCanvas.width, wCanvas.height);
      wCtx.save();

      const viewedAt = format(new Date(), "dd MMM yyyy HH:mm:ss");
      const lines = [
        `Viewed by: ${watermarkInfo.userName}`,
        watermarkInfo.userEmail,
        `IP: ${watermarkInfo.userIp}`,
        viewedAt,
      ];

      const baseFontSize = 13;
      const fontSize = baseFontSize * zoom;
      wCtx.font = `bold ${fontSize}px monospace`;
      const lineHeight = fontSize * 1.35;
      const blockHeight = lines.length * lineHeight;
      const blockWidth = Math.max(...lines.map(l => wCtx.measureText(l).width));
      const gapX = 30 * zoom;
      const gapY = 30 * zoom;
      const stepX = blockWidth + gapX;
      const stepY = blockHeight + gapY;
      const w = viewport.width;
      const h = viewport.height;
      const angle = -0.35;
      const cosA = Math.abs(Math.cos(angle));
      const sinA = Math.abs(Math.sin(angle));
      const rotW = w * cosA + h * sinA;
      const rotH = w * sinA + h * cosA;
      const startX = -(rotW / 2) - stepX;
      const startY = -(rotH / 2) - stepY;
      const endX = (rotW / 2) + stepX;
      const endY = (rotH / 2) + stepY;

      wCtx.translate(w / 2, h / 2);
      wCtx.rotate(angle);

      wCtx.fillStyle = "rgba(220, 38, 38, 0.14)";
      for (let by = startY; by < endY; by += stepY) {
        for (let bx = startX; bx < endX; bx += stepX) {
          lines.forEach((line, i) => {
            wCtx.fillText(line, bx, by + i * lineHeight);
          });
        }
      }

      wCtx.restore();
    } catch (err) {
      console.error("Render error:", err);
    }
    setRendering(false);
  }, [pdfDoc, watermarkInfo]);

  useEffect(() => {
    if (pdfDoc) renderPage(currentPage, scale);
  }, [pdfDoc, currentPage, scale, renderPage]);

  const goToPage = (delta: number) => {
    setCurrentPage(p => Math.max(1, Math.min(totalPages, p + delta)));
  };

  const changeZoom = (delta: number) => {
    setScale(s => Math.max(0.5, Math.min(3, s + delta)));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center gap-2 py-1.5 bg-zinc-800 border-b border-zinc-700 shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7 text-white" onClick={() => goToPage(-1)} disabled={currentPage <= 1} data-testid="button-prev-page">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-zinc-300 min-w-[80px] text-center" data-testid="text-page-info">
          Page {currentPage} of {totalPages}
        </span>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-white" onClick={() => goToPage(1)} disabled={currentPage >= totalPages} data-testid="button-next-page">
          <ChevronRight className="w-4 h-4" />
        </Button>
        <div className="w-px h-4 bg-zinc-600 mx-1" />
        <Button size="icon" variant="ghost" className="h-7 w-7 text-white" onClick={() => changeZoom(-0.25)} disabled={scale <= 0.5} data-testid="button-zoom-out">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-zinc-300 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-white" onClick={() => changeZoom(0.25)} disabled={scale >= 3} data-testid="button-zoom-in">
          <ZoomIn className="w-4 h-4" />
        </Button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto flex justify-center bg-zinc-700 p-4" data-testid="secure-viewer-content">
        {pdfError ? (
          <div className="flex flex-col items-center justify-center h-full text-white">
            <ShieldCheck className="w-16 h-16 text-amber-400 mb-4" />
            <p className="text-lg font-medium">{pdfError}</p>
            <p className="text-sm text-zinc-400 mt-2">The document cannot be displayed.</p>
          </div>
        ) : (
          <div className="relative inline-block">
            <canvas ref={canvasRef} className="block shadow-2xl" />
            <canvas
              ref={watermarkCanvasRef}
              className="absolute top-0 left-0 pointer-events-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SecureViewer({ doc, userName, userEmail, onClose }: { doc: any; userName: string; userEmail: string; onClose: () => void }) {
  const isPdf = doc.mimeType === "application/pdf";
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientIp, setClientIp] = useState("loading...");

  useEffect(() => {
    fetch("/api/auth/client-info", { credentials: "include" })
      .then(r => r.json())
      .then(d => setClientIp(d.ip || "unknown"))
      .catch(() => setClientIp("unknown"));
  }, []);

  const [signedViewUrl, setSignedViewUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadDocument = async () => {
      try {
        const res = await fetch(`/api/documents/${doc.id}/view`, { credentials: "include" });
        if (!res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const err = await res.json().catch(() => ({ message: "Access denied" }));
            setLoadError(err.message || "Failed to load document");
          } else {
            setLoadError("Failed to load document");
          }
          setLoading(false);
          return;
        }
        const buffer = await res.arrayBuffer();
        if (cancelled) return;
        if (isPdf) {
          setPdfData(buffer);
        } else {
          const blob = new Blob([buffer], { type: doc.mimeType || "application/octet-stream" });
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          setSignedViewUrl(url);
        }
        setLoading(false);
      } catch {
        setLoadError("Failed to load document");
        setLoading(false);
      }
    };
    loadDocument();
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [doc.id, isPdf]);

  const watermarkInfo: WatermarkInfo = {
    userName,
    userEmail,
    userIp: clientIp,
  };

  const [blurred, setBlurred] = useState(false);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && (e.key === "s" || e.key === "S" || e.key === "p" || e.key === "P")) ||
        (e.metaKey && (e.key === "s" || e.key === "S" || e.key === "p" || e.key === "P")) ||
        e.key === "PrintScreen" ||
        (e.ctrlKey && e.shiftKey && (e.key === "s" || e.key === "S")) ||
        (e.metaKey && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5")) ||
        (e.key === "F12") ||
        (e.ctrlKey && e.shiftKey && (e.key === "i" || e.key === "I")) ||
        (e.key === "Snapshot")
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "PrintScreen" || e.key === "Snapshot") {
          setBlurred(true);
          navigator.clipboard?.writeText("Screenshots are disabled for confidential documents").catch(() => {});
        }
      }
    };
    const handleBeforePrint = (e: Event) => e.preventDefault();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setBlurred(true);
      }
    };
    const handleWindowBlur = () => setBlurred(true);
    const handleWindowFocus = () => setBlurred(false);
    const handleDragStart = (e: DragEvent) => e.preventDefault();
    const handleCopy = (e: ClipboardEvent) => e.preventDefault();

    const printBlockerStyle = document.createElement("style");
    printBlockerStyle.id = "secure-viewer-print-blocker";
    printBlockerStyle.textContent = `
      @media print { body * { display: none !important; visibility: hidden !important; } body::after { content: "Printing is disabled for confidential documents — Study Info Centre"; display: block !important; visibility: visible !important; font-size: 24px; text-align: center; padding: 100px 40px; color: #333; } }
      [data-testid="secure-viewer-overlay"] canvas { -webkit-user-drag: none; }
      [data-testid="secure-viewer-content"] { -webkit-filter: none; }
    `;
    document.head.appendChild(printBlockerStyle);

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("copy", handleCopy);
    window.addEventListener("beforeprint", handleBeforePrint);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("copy", handleCopy);
      window.removeEventListener("beforeprint", handleBeforePrint);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      const el = document.getElementById("secure-viewer-print-blocker");
      if (el) el.remove();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col" data-testid="secure-viewer-overlay" style={{ WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" }}>
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-700 shrink-0">
        <div className="flex items-center gap-2 text-white">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium">Secure Document Viewer</span>
          <span className="text-xs text-zinc-400 ml-2">{doc.originalFilename} (v{doc.versionNo})</span>
        </div>
        <div className="flex items-center gap-2">
          {blurred && (
            <span className="text-xs text-amber-400 flex items-center gap-1" data-testid="text-security-warning">
              <ShieldCheck className="w-3 h-3" /> Content hidden — click to restore
            </span>
          )}
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
      </div>

      <div className="flex-1 relative overflow-hidden select-none" style={{ userSelect: "none", WebkitUserSelect: "none" }}>
        {blurred && (
          <div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-900/95 cursor-pointer"
            onClick={() => setBlurred(false)}
            data-testid="security-blur-overlay"
          >
            <ShieldCheck className="w-16 h-16 text-amber-400 mb-4" />
            <p className="text-lg font-medium text-white">Content Hidden for Security</p>
            <p className="text-sm text-zinc-400 mt-2">Document content is hidden while the window is not in focus.</p>
            <p className="text-sm text-zinc-400 mt-1">Click anywhere to reveal the document.</p>
          </div>
        )}
        <div style={{ filter: blurred ? "blur(30px)" : "none", transition: "filter 0.15s" }} className="h-full">
          {loadError ? (
            <div className="flex flex-col items-center justify-center h-full text-white">
              <ShieldCheck className="w-16 h-16 text-red-500 mb-4" />
              <p className="text-lg font-medium">Access Denied</p>
              <p className="text-sm text-zinc-400 mt-1">{loadError}</p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center h-full text-white">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mb-4" />
              <p className="text-sm text-zinc-400">Loading secure document...</p>
            </div>
          ) : isPdf && pdfData ? (
            <PdfCanvasViewer pdfData={pdfData} watermarkInfo={watermarkInfo} />
          ) : signedViewUrl && doc.mimeType?.startsWith("image/") ? (
            <div className="flex items-center justify-center h-full p-4">
              <img src={signedViewUrl} alt={doc.originalFilename} className="max-w-full max-h-full object-contain" style={{ pointerEvents: "none" }} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-white">
              <File className="w-16 h-16 text-zinc-500 mb-4" />
              <p className="text-lg font-medium">{doc.originalFilename}</p>
              <p className="text-sm text-zinc-400 mt-1">{formatFileSize(doc.sizeBytes)}</p>
              <p className="text-xs text-zinc-500 mt-4">This file type cannot be previewed in the browser.</p>
              <p className="text-xs text-zinc-500">Use the download button if you have permission.</p>
            </div>
          )}
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
  const canDelete = hasPermission("document.delete");
  const [showDialog, setShowDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewingDoc, setViewingDoc] = useState<any>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

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
    if (!file) {
      toast({ title: "Please select a file", variant: "destructive" });
      return;
    }
    if (!fileName.trim()) {
      toast({ title: "File Name is required", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileName", fileName.trim());

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
      setFileName("");
      toast({ title: "Document uploaded successfully" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      const res = await fetch(`/api/documents/${doc.id}/download`, { credentials: "include" });
      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const err = await res.json().catch(() => ({ message: "Download failed" }));
          toast({ title: "Download failed", description: err.message, variant: "destructive" });
        } else {
          toast({ title: "Download failed", description: "Unable to download file", variant: "destructive" });
        }
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.originalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (doc: any) => {
    setDeleting(doc.id);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/agreements", agreementId, "documents"] });
      await queryClient.refetchQueries({ queryKey: ["/api/agreements", agreementId, "documents"] });
      toast({ title: "Document deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading) return <div className="space-y-3">{Array.from({length: 2}).map((_,i) => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Agreement Documents</h3>
        {canUpload && (
          <Dialog open={showDialog} onOpenChange={(open) => { if (open) { setFileName(""); if (fileRef.current) fileRef.current.value = ""; } setShowDialog(open); }}>
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
                  <Label>File Name <span className="text-red-500">*</span></Label>
                  <Input value={fileName} onChange={e => setFileName(e.target.value)} placeholder="e.g., Commission Schedule 2026" data-testid="input-file-name" />
                </div>
                <Button onClick={handleUpload} className="w-full" disabled={uploading || !fileName.trim()} data-testid="button-submit-upload">
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
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Delete"
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-delete-document-${doc.id}`}
                            disabled={deleting === doc.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Document</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{doc.originalFilename}" (v{doc.versionNo})? This action cannot be undone and the file will be permanently removed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(doc)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid="button-confirm-delete"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
          userName={user?.user?.fullName || "Unknown User"}
          userEmail={user?.user?.email || "Unknown"}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </div>
  );
}
