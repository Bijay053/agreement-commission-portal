import { useState, useRef, useEffect, useCallback } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertTriangle, XCircle, Upload, Pen } from "lucide-react";

interface OfferData {
  employeeName: string;
  position: string;
  title: string;
  issueDate: string;
  startDate: string;
  proposedSalary: string;
  salaryCurrency: string;
  department: string;
  workLocation: string;
  probationPeriod: string;
  clauses: Array<{ order: number; title: string; content: string }>;
  clauseText: string;
  documentType: string;
  alreadySigned?: boolean;
  status?: string;
  message?: string;
}

function formatClauseContent(text: string): string {
  let escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/__(.+?)__/g, '<u>$1</u>');
  escaped = escaped.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return escaped;
}

async function apiRequest(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json();
}

function removeBackground(img: HTMLImageElement, canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");

  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const corners = [
    [0, 0], [canvas.width - 1, 0],
    [0, canvas.height - 1], [canvas.width - 1, canvas.height - 1],
  ];
  let bgR = 0, bgG = 0, bgB = 0, count = 0;
  for (const [cx, cy] of corners) {
    for (let dx = 0; dx < 5; dx++) {
      for (let dy = 0; dy < 5; dy++) {
        const sx = Math.min(cx + dx, canvas.width - 1);
        const sy = Math.min(cy + dy, canvas.height - 1);
        const idx = (sy * canvas.width + sx) * 4;
        bgR += data[idx];
        bgG += data[idx + 1];
        bgB += data[idx + 2];
        count++;
      }
    }
  }
  bgR = Math.round(bgR / count);
  bgG = Math.round(bgG / count);
  bgB = Math.round(bgB / count);

  const threshold = 60;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
    if (dist < threshold) {
      data[i + 3] = 0;
    } else {
      const factor = Math.min(1, (dist - threshold) / 40);
      data[i + 3] = Math.round(255 * factor);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export default function SignOfferPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const sigRef = useRef<SignatureCanvas>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgRemovalCanvas = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [signMode, setSignMode] = useState<"draw" | "upload">("draw");
  const [uploadedSignature, setUploadedSignature] = useState<string | null>(null);
  const [processingImage, setProcessingImage] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest(`/api/offer-signing/verify/${token}`);
        setOffer(data);
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, [token]);

  const handleClear = () => {
    if (signMode === "draw") {
      sigRef.current?.clear();
    } else {
      setUploadedSignature(null);
    }
    setHasSigned(false);
  };

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, etc.)");
      return;
    }

    setProcessingImage(true);
    setError("");

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = bgRemovalCanvas.current;
        if (!canvas) {
          setProcessingImage(false);
          return;
        }
        const result = removeBackground(img, canvas);
        setUploadedSignature(result);
        setHasSigned(true);
        setProcessingImage(false);
      };
      img.onerror = () => {
        setError("Failed to load image. Please try another file.");
        setProcessingImage(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleSubmit = async () => {
    let signatureData = "";

    if (signMode === "draw") {
      if (!sigRef.current || sigRef.current.isEmpty()) return;
      signatureData = sigRef.current.toDataURL("image/png");
    } else {
      if (!uploadedSignature) return;
      signatureData = uploadedSignature;
    }

    setSubmitting(true);
    try {
      const data = await apiRequest(`/api/offer-signing/submit/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureData, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      setSuccess(data.message);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again or contact HR.");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 mx-auto animate-spin text-blue-600" />
          <p className="text-gray-600">Loading your offer letter...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle className="w-16 h-16 mx-auto text-emerald-500" />
            <h2 className="text-xl font-semibold text-gray-900" data-testid="text-sign-success">Offer Letter Signed</h2>
            <p className="text-gray-600" data-testid="text-sign-message">{success}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (offer?.alreadySigned) {
    const isFullySigned = offer.status === 'signed' || offer.status === 'completed' || offer.status === 'accepted';
    const iconColor = isFullySigned ? 'text-emerald-500' : 'text-amber-500';
    const title = isFullySigned ? 'Offer Letter Fully Signed' : 'Offer Letter Already Signed';

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle className={`w-16 h-16 mx-auto ${iconColor}`} />
            <h2 className="text-xl font-semibold text-gray-900" data-testid="text-already-signed-title">{title}</h2>
            <p className="text-gray-600 leading-relaxed" data-testid="text-already-signed-message">{offer.message}</p>
            {!isFullySigned && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  No further action is needed from your side. You will be notified once the process is complete.
                </p>
              </div>
            )}
            {isFullySigned && (
              <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm text-emerald-800">
                  Please check your email for the signed copy. If you haven't received it, contact HR.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !offer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 text-center space-y-4">
            <XCircle className="w-16 h-16 mx-auto text-red-500" />
            <h2 className="text-xl font-semibold text-gray-900">Unable to Load Offer Letter</h2>
            <p className="text-gray-600" data-testid="text-sign-error">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!offer) return null;

  const canSubmit = agreed && hasSigned && !submitting;

  return (
    <div className="min-h-screen bg-gray-50" data-testid="page-sign-offer">
      <canvas ref={bgRemovalCanvas} style={{ display: "none" }} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
        data-testid="input-signature-upload"
      />

      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-blue-700 flex items-center justify-center mx-auto mb-3">
            <span className="text-lg font-bold text-white">SIC</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Study Info Centre</h1>
          <p className="text-sm text-gray-500 mt-1">Job Offer Letter — Please Review and Sign</p>
        </div>

        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Name:</span> <strong>{offer.employeeName}</strong></div>
              <div><span className="text-gray-500">Position:</span> <strong>{offer.position}</strong></div>
              {offer.department && <div><span className="text-gray-500">Department:</span> {offer.department}</div>}
              {offer.startDate && <div><span className="text-gray-500">Start Date:</span> {offer.startDate}</div>}
              {offer.proposedSalary && (
                <div><span className="text-gray-500">Salary:</span> {offer.salaryCurrency} {offer.proposedSalary}</div>
              )}
              {offer.workLocation && <div><span className="text-gray-500">Location:</span> {offer.workLocation}</div>}
              {offer.probationPeriod && <div><span className="text-gray-500">Probation:</span> {offer.probationPeriod}</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto p-6" data-testid="text-offer-content">
              <h2 className="text-lg font-bold text-center mb-6">JOB OFFER LETTER</h2>
              {(offer.clauses || []).map((clause, i) => (
                <div key={i} className="mb-6">
                  <h3 className="font-semibold text-sm text-blue-800 mb-2">
                    {clause.order}. {clause.title}
                  </h3>
                  <div
                    className="text-sm text-gray-700 whitespace-pre-line leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: formatClauseContent(clause.content) }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="agree-terms"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                data-testid="checkbox-agree"
              />
              <label htmlFor="agree-terms" className="text-sm text-gray-700 leading-snug cursor-pointer">
                I have read and understood this offer letter and agree to all terms and conditions.
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Sign Here</label>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSignMode("draw");
                      setUploadedSignature(null);
                      setHasSigned(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      signMode === "draw"
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                    data-testid="button-draw-mode"
                  >
                    <Pen className="w-3.5 h-3.5" /> Draw
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSignMode("upload");
                      sigRef.current?.clear();
                      setHasSigned(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      signMode === "upload"
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                    data-testid="button-upload-mode"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload Image
                  </button>
                </div>
              </div>

              {signMode === "draw" ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white">
                  <SignatureCanvas
                    ref={sigRef}
                    canvasProps={{
                      className: "w-full",
                      style: { width: "100%", height: "180px" },
                      "data-testid": "canvas-signature",
                    }}
                    onEnd={() => setHasSigned(true)}
                  />
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg bg-white flex items-center justify-center"
                  style={{ minHeight: "180px" }}
                >
                  {processingImage ? (
                    <div className="text-center space-y-2 p-6">
                      <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
                      <p className="text-sm text-gray-500">Removing background...</p>
                    </div>
                  ) : uploadedSignature ? (
                    <div className="p-4 w-full flex justify-center" style={{ background: "repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%) 50% / 16px 16px" }}>
                      <img
                        src={uploadedSignature}
                        alt="Your signature"
                        className="max-h-[160px] max-w-full object-contain"
                        data-testid="img-uploaded-signature"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-center space-y-2 p-8 w-full hover:bg-gray-50 transition-colors rounded-lg cursor-pointer"
                      data-testid="button-select-signature-image"
                    >
                      <Upload className="w-10 h-10 mx-auto text-gray-400" />
                      <p className="text-sm text-gray-600 font-medium">Click to upload signature image</p>
                      <p className="text-xs text-gray-400">Background will be removed automatically</p>
                    </button>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={handleClear} data-testid="button-clear-signature">
                  Clear
                </Button>
                {signMode === "upload" && uploadedSignature && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-reupload-signature"
                  >
                    Upload Different Image
                  </Button>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="w-4 h-4" /> {error}
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={!canSubmit}
              onClick={handleSubmit}
              data-testid="button-submit-signature"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
              ) : (
                "Submit Signature"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
