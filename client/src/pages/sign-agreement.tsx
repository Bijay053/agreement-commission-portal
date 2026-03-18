import { useState, useRef, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface AgreementData {
  employeeName: string;
  position: string;
  agreementDate: string;
  effectiveFrom: string;
  effectiveTo: string;
  clauses: Array<{ order: number; title: string; content: string }>;
  agreementText: string;
}

async function apiRequest(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export default function SignAgreementPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const sigRef = useRef<SignatureCanvas>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [agreement, setAgreement] = useState<AgreementData | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest(`/api/signing/verify/${token}`);
        setAgreement(data);
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, [token]);

  const handleClear = () => {
    sigRef.current?.clear();
    setHasSigned(false);
  };

  const handleSubmit = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    setSubmitting(true);
    try {
      const signatureData = sigRef.current.toDataURL("image/png");
      const data = await apiRequest(`/api/signing/submit/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureData }),
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
          <p className="text-gray-600">Loading your agreement...</p>
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
            <h2 className="text-xl font-semibold text-gray-900" data-testid="text-sign-success">Agreement Signed</h2>
            <p className="text-gray-600" data-testid="text-sign-message">{success}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !agreement) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 text-center space-y-4">
            <XCircle className="w-16 h-16 mx-auto text-red-500" />
            <h2 className="text-xl font-semibold text-gray-900">Unable to Load Agreement</h2>
            <p className="text-gray-600" data-testid="text-sign-error">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!agreement) return null;

  return (
    <div className="min-h-screen bg-gray-50" data-testid="page-sign-agreement">
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-blue-700 flex items-center justify-center mx-auto mb-3">
            <span className="text-lg font-bold text-white">SIC</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Study Info Centre Pvt. Ltd.</h1>
          <p className="text-sm text-gray-500 mt-1">Employment Agreement — Please Review and Sign</p>
        </div>

        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Employee:</span> <strong>{agreement.employeeName}</strong></div>
              <div><span className="text-gray-500">Position:</span> <strong>{agreement.position}</strong></div>
              {agreement.effectiveFrom && <div><span className="text-gray-500">From:</span> {agreement.effectiveFrom}</div>}
              {agreement.effectiveTo && <div><span className="text-gray-500">To:</span> {agreement.effectiveTo}</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto p-6" data-testid="text-agreement-content">
              <h2 className="text-lg font-bold text-center mb-6">EMPLOYMENT AGREEMENT</h2>
              {(agreement.clauses || []).map((clause, i) => (
                <div key={i} className="mb-6">
                  <h3 className="font-semibold text-sm text-blue-800 mb-2">
                    {clause.order}. {clause.title}
                  </h3>
                  <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                    {clause.content}
                  </div>
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
                I have read and understood this agreement and agree to all terms and conditions.
              </label>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Sign Here</label>
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
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={handleClear} data-testid="button-clear-signature">
                  Clear
                </Button>
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
              disabled={!agreed || !hasSigned || submitting}
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
