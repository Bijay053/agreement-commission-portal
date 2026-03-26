import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  User, Clock, Calendar, FileText, LogOut, Shield, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, AlertCircle, Download, Briefcase,
  Camera, MapPin, Loader2, RefreshCw,
} from "lucide-react";

type Tab = "profile" | "attendance" | "leave" | "payslips";

export default function EmployeePortal() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "profile", label: "My Profile", icon: User },
    { key: "attendance", label: "Attendance", icon: Clock },
    { key: "leave", label: "Leave", icon: Calendar },
    { key: "payslips", label: "Payslips", icon: FileText },
  ];

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-56 shrink-0 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-xs font-bold text-primary-foreground">SIC</span>
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">HRMS Portal</p>
              <p className="text-[10px] text-muted-foreground">Study Info Centre</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                data-testid={`tab-${tab.key}`}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
              {user?.user?.fullName?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{user?.user?.fullName || "Employee"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            data-testid="button-logout"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        {activeTab === "profile" && <ProfileTab />}
        {activeTab === "attendance" && <AttendanceTab />}
        {activeTab === "leave" && <LeaveTab />}
        {activeTab === "payslips" && <PayslipsTab />}
      </main>
    </div>
  );
}

function ProfileTab() {
  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ["/api/hrms/my/profile"],
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-60" /></div>;
  if (!profile) return <div className="text-center py-12 text-muted-foreground">No employee profile found linked to your account.</div>;

  const infoRows = [
    { label: "Full Name", value: profile.full_name },
    { label: "Email", value: profile.email },
    { label: "Phone", value: profile.phone },
    { label: "Organization", value: profile.organization_name },
    { label: "Department", value: profile.department_name },
    { label: "Designation", value: profile.designation },
    { label: "Employment Type", value: profile.employment_type },
    { label: "Join Date", value: profile.join_date },
  ].filter(r => r.value);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold" data-testid="text-profile-title">My Profile</h2>
        <p className="text-sm text-muted-foreground">Your employee information</p>
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
              {profile.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div>
              <h3 className="text-xl font-semibold" data-testid="text-employee-name">{profile.full_name}</h3>
              <p className="text-sm text-muted-foreground">{profile.designation || "Employee"}</p>
              {profile.department_name && <Badge variant="outline" className="mt-1">{profile.department_name}</Badge>}
            </div>
          </div>
          <div className="space-y-3">
            {infoRows.map(row => (
              <div key={row.label} className="flex justify-between py-2 border-b last:border-0">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className="text-sm font-medium" data-testid={`text-${row.label.toLowerCase().replace(/\s+/g, '-')}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AttendanceTab() {
  const { toast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [showCheckin, setShowCheckin] = useState(false);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/hrms/my/attendance", { month, year }],
    queryFn: async () => {
      const res = await fetch(`/api/hrms/my/attendance?month=${month}&year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const records = data?.records || [];
  const summary = data?.summary || {};
  const today = data?.today;
  const onlineAllowed = data?.online_checkin_allowed;
  const requirePhoto = data?.require_photo ?? true;
  const requireLocation = data?.require_location ?? true;

  const hasCheckedIn = today?.check_in;
  const hasCheckedOut = today?.check_out;

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-attendance-title">My Attendance</h2>
          <p className="text-sm text-muted-foreground">Your attendance records</p>
        </div>
        <div className="flex items-center gap-2">
          {onlineAllowed && (
            <Button
              onClick={() => setShowCheckin(true)}
              size="sm"
              data-testid="button-remote-checkin"
              variant={hasCheckedIn && !hasCheckedOut ? "destructive" : "default"}
            >
              <Clock className="h-4 w-4 mr-1" />
              {!hasCheckedIn ? "Check In" : !hasCheckedOut ? "Check Out" : "Done Today"}
            </Button>
          )}
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {onlineAllowed && (
        <TodayStatusCard today={today} />
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600" data-testid="text-present-count">{summary.present || 0}</p><p className="text-xs text-muted-foreground">Present</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600" data-testid="text-absent-count">{summary.absent || 0}</p><p className="text-xs text-muted-foreground">Absent</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-600" data-testid="text-late-count">{summary.late || 0}</p><p className="text-xs text-muted-foreground">Late</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-blue-600" data-testid="text-leave-count">{summary.on_leave || 0}</p><p className="text-xs text-muted-foreground">On Leave</p></CardContent></Card>
        </div>
      )}

      {isLoading ? <Skeleton className="h-60" /> : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Late</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No attendance records for this period</TableCell></TableRow>
              ) : records.map((r: any) => (
                <TableRow key={r.date}>
                  <TableCell className="font-medium">{r.date}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "present" ? "default" : r.status === "absent" ? "destructive" : "outline"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.check_in ? new Date(r.check_in).toLocaleTimeString() : "—"}</TableCell>
                  <TableCell>{r.check_out ? new Date(r.check_out).toLocaleTimeString() : "—"}</TableCell>
                  <TableCell>{r.is_late ? <Badge variant="destructive" className="text-xs">{r.late_minutes}m</Badge> : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {showCheckin && (
        <RemoteCheckInDialog
          open={showCheckin}
          onClose={() => setShowCheckin(false)}
          isCheckOut={!!hasCheckedIn && !hasCheckedOut}
          alreadyDone={!!hasCheckedIn && !!hasCheckedOut}
          requirePhoto={requirePhoto}
          requireLocation={requireLocation}
          onSuccess={() => {
            refetch();
            queryClient.refetchQueries({ queryKey: ["/api/hrms/my/attendance"] });
          }}
        />
      )}
    </div>
  );
}

function TodayStatusCard({ today }: { today: any }) {
  const nowStr = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Today — {nowStr}</p>
            {today ? (
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm">In: {today.check_in ? new Date(today.check_in).toLocaleTimeString() : "—"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${today.check_out ? "bg-red-500" : "bg-muted-foreground/30"}`} />
                  <span className="text-sm">Out: {today.check_out ? new Date(today.check_out).toLocaleTimeString() : "—"}</span>
                </div>
                {today.is_late && (
                  <Badge variant="destructive" className="text-xs">Late by {today.late_minutes}m</Badge>
                )}
                {today.work_hours > 0 && (
                  <span className="text-sm text-muted-foreground">{today.work_hours}h worked</span>
                )}
              </div>
            ) : (
              <p className="text-sm mt-1 text-muted-foreground">Not checked in yet</p>
            )}
          </div>
          <Badge variant={today?.check_in ? "default" : "outline"} className="text-xs">
            {!today ? "Absent" : today.check_out ? "Completed" : "Checked In"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function RemoteCheckInDialog({
  open, onClose, isCheckOut, alreadyDone, requirePhoto, requireLocation, onSuccess,
}: {
  open: boolean; onClose: () => void; isCheckOut: boolean; alreadyDone: boolean;
  requirePhoto: boolean; requireLocation: boolean; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      setCameraError("Camera access denied. Please allow camera permission.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedPhoto(dataUrl);
    canvas.toBlob(blob => {
      if (blob) setPhotoBlob(blob);
    }, "image/jpeg", 0.8);
    stopCamera();
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedPhoto(null);
    setPhotoBlob(null);
    startCamera();
  }, [startCamera]);

  const getLocation = useCallback(() => {
    setLocationLoading(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
      setLocationLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLoading(false);
      },
      err => {
        setLocationError(err.code === 1 ? "Location access denied. Please allow location permission." : "Could not get location. Please try again.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, []);

  useEffect(() => {
    if (open && !alreadyDone) {
      if (requirePhoto) startCamera();
      if (requireLocation) getLocation();
    }
    return () => stopCamera();
  }, [open]);

  const handleSubmit = async () => {
    if (requirePhoto && !photoBlob) {
      toast({ title: "Please take a selfie first", variant: "destructive" });
      return;
    }
    if (requireLocation && !location) {
      toast({ title: "Please allow location access", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      let photoUrl: string | undefined;
      if (photoBlob) {
        const formData = new FormData();
        formData.append("photo", photoBlob, "selfie.jpg");
        const uploadRes = await fetch("/api/hrms/attendance/photo-upload", {
          method: "POST", body: formData, credentials: "include",
        });
        if (!uploadRes.ok) throw new Error("Photo upload failed");
        const uploadData = await uploadRes.json();
        photoUrl = uploadData.url;
      }

      const endpoint = isCheckOut ? "/api/hrms/attendance/online-checkout" : "/api/hrms/attendance/online-checkin";
      const body: any = {};
      if (location) body.location = { lat: location.lat, lng: location.lng };
      if (photoUrl) body.photo_url = photoUrl;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed");
      }

      toast({ title: isCheckOut ? "Checked out successfully" : "Checked in successfully" });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (alreadyDone) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Already Done</DialogTitle></DialogHeader>
          <div className="text-center py-6">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">You have already checked in and out today.</p>
          </div>
          <DialogFooter><Button onClick={onClose}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={() => { stopCamera(); onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCheckOut ? <><Clock className="h-5 w-5 text-red-500" /> Remote Check Out</> : <><Clock className="h-5 w-5 text-green-500" /> Remote Check In</>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {requirePhoto && (
            <div>
              <Label className="text-sm font-medium flex items-center gap-1.5 mb-2">
                <Camera className="h-4 w-4" /> Live Selfie
              </Label>
              {cameraError ? (
                <div className="bg-destructive/10 rounded-lg p-4 text-center">
                  <p className="text-sm text-destructive">{cameraError}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={startCamera}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                </div>
              ) : capturedPhoto ? (
                <div className="relative">
                  <img src={capturedPhoto} alt="Selfie" className="w-full rounded-lg border" data-testid="img-selfie-preview" />
                  <Button
                    variant="secondary" size="sm"
                    className="absolute bottom-2 right-2"
                    onClick={retakePhoto}
                    data-testid="button-retake-photo"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Retake
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <video
                    ref={videoRef}
                    className="w-full rounded-lg border bg-black"
                    autoPlay playsInline muted
                    style={{ transform: "scaleX(-1)" }}
                    data-testid="video-camera"
                  />
                  {cameraActive && (
                    <Button
                      className="absolute bottom-3 left-1/2 -translate-x-1/2"
                      onClick={capturePhoto}
                      data-testid="button-capture-photo"
                    >
                      <Camera className="h-4 w-4 mr-1" /> Capture
                    </Button>
                  )}
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          <div>
            <Label className="text-sm font-medium flex items-center gap-1.5 mb-2">
              <MapPin className="h-4 w-4" /> Your Location
            </Label>
            {locationLoading ? (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Getting your location...</span>
              </div>
            ) : locationError ? (
              <div className="bg-destructive/10 rounded-lg p-3">
                <p className="text-sm text-destructive">{locationError}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={getLocation}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Retry
                </Button>
              </div>
            ) : location ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Location captured</span>
                  <span className="text-xs text-muted-foreground ml-auto">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</span>
                </div>
                <div className="rounded-lg overflow-hidden border h-48">
                  <iframe
                    title="Location Map"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.005},${location.lat - 0.003},${location.lng + 0.005},${location.lat + 0.003}&layer=mapnik&marker=${location.lat},${location.lng}`}
                    data-testid="map-location"
                  />
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={getLocation}>
                <MapPin className="h-3 w-3 mr-1" /> Get Location
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { stopCamera(); onClose(); }}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || (requirePhoto && !capturedPhoto) || (requireLocation && !location)}
            variant={isCheckOut ? "destructive" : "default"}
            data-testid={isCheckOut ? "button-submit-checkout" : "button-submit-checkin"}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : isCheckOut ? <LogOut className="h-4 w-4 mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
            {submitting ? "Submitting..." : isCheckOut ? "Confirm Check Out" : "Confirm Check In"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeaveTab() {
  const { toast } = useToast();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type_id: "", start_date: "", end_date: "", reason: "" });

  const { data: balance, isLoading: balLoading } = useQuery<any[]>({
    queryKey: ["/api/hrms/my/leave-balance"],
  });

  const { data: requests, isLoading: reqLoading } = useQuery<any[]>({
    queryKey: ["/api/hrms/my/leave-requests"],
  });

  const submitMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/my/leave-requests", data),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/hrms/my/leave-requests"] });
      queryClient.refetchQueries({ queryKey: ["/api/hrms/my/leave-balance"] });
      setShowRequestForm(false);
      setLeaveForm({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
      toast({ title: "Leave request submitted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to submit", description: err.message, variant: "destructive" });
    },
  });

  const statusIcon = (s: string) => {
    if (s === "approved") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (s === "rejected") return <XCircle className="h-4 w-4 text-red-500" />;
    return <AlertCircle className="h-4 w-4 text-amber-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-leave-title">Leave Management</h2>
          <p className="text-sm text-muted-foreground">Your leave balance and requests</p>
        </div>
        <Button onClick={() => setShowRequestForm(true)} size="sm" data-testid="button-request-leave">Request Leave</Button>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Leave Balance</h3>
        {balLoading ? <Skeleton className="h-20" /> : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(balance || []).map((b: any) => (
              <Card key={b.leave_type_id || b.leave_type}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{b.leave_type_name || b.leave_type}</p>
                  <p className="text-lg font-bold" data-testid={`text-balance-${b.leave_type_name || b.leave_type}`}>{b.remaining ?? b.balance ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">of {b.allocated ?? b.total ?? 0}</p>
                </CardContent>
              </Card>
            ))}
            {(!balance || balance.length === 0) && <p className="text-sm text-muted-foreground col-span-4">No leave balance configured</p>}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Leave Requests</h3>
        {reqLoading ? <Skeleton className="h-40" /> : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!requests || requests.length === 0) ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No leave requests</TableCell></TableRow>
                ) : requests.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.leave_type_name || r.leave_type}</TableCell>
                    <TableCell>{r.start_date}</TableCell>
                    <TableCell>{r.end_date}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {statusIcon(r.status)}
                        <span className="text-sm capitalize">{r.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.reason || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Leave Type</Label>
              <Select value={leaveForm.leave_type_id} onValueChange={v => setLeaveForm({ ...leaveForm, leave_type_id: v })}>
                <SelectTrigger data-testid="select-leave-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {(balance || []).map((b: any) => (
                    <SelectItem key={b.leave_type_id || b.id} value={b.leave_type_id || b.id}>{b.leave_type_name || b.leave_type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <input type="date" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={leaveForm.start_date} onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })} data-testid="input-leave-start" />
              </div>
              <div>
                <Label>End Date</Label>
                <input type="date" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={leaveForm.end_date} onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })} data-testid="input-leave-end" />
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Reason for leave..." data-testid="input-leave-reason" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestForm(false)}>Cancel</Button>
            <Button onClick={() => submitMutation.mutate(leaveForm)} disabled={submitMutation.isPending} data-testid="button-submit-leave">Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayslipsTab() {
  const { data: payslips, isLoading } = useQuery<any[]>({
    queryKey: ["/api/hrms/my/payslips"],
  });

  const handleDownload = async (id: string) => {
    const res = await fetch(`/api/hrms/my/payslips/${id}/pdf`, { credentials: "include" });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslip-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold" data-testid="text-payslips-title">My Payslips</h2>
        <p className="text-sm text-muted-foreground">View and download your payslips</p>
      </div>

      {isLoading ? <Skeleton className="h-60" /> : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Gross Salary</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!payslips || payslips.length === 0) ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payslips available</TableCell></TableRow>
              ) : payslips.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.month_name || p.month}/{p.year}</TableCell>
                  <TableCell>{Number(p.gross_salary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{Number(p.total_deductions || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="font-semibold">{Number(p.net_salary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell><Badge variant="default">{p.status}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(p.id)} data-testid={`button-download-payslip-${p.id}`}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
