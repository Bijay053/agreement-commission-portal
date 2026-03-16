import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import {
  Plus, Search, Eye, EyeOff, Copy, ExternalLink, RotateCcw,
  MoreVertical, Edit, Trash2, Shield, Globe, User, Key,
  AlertTriangle, Check, LogIn, Clipboard, Lock,
} from "lucide-react";

interface Portal {
  id: number;
  portalName: string;
  portalUrl: string;
  domain: string;
  username: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  category: string;
  country: string;
  team: string;
  notes: string;
  status: string;
  createdBy: number | null;
  updatedBy: number | null;
  passwordUpdatedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface AccessLog {
  id: number;
  portalId: number;
  userId: number;
  userName: string;
  userEmail: string;
  action: string;
  portalName: string;
  ipAddress: string;
  result: string;
  note: string;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  portal_created: "Created",
  portal_edited: "Edited",
  portal_deactivated: "Deactivated",
  password_revealed: "Password Revealed",
  password_rotated: "Password Rotated",
  username_copied: "Username Copied",
  password_copied: "Password Copied",
  portal_opened: "Portal Opened",
  open_and_fill: "Open & Fill",
  extension_matched: "Extension Match",
  extension_reveal: "Extension Reveal",
  autofill_success: "Autofill OK",
  autofill_failed: "Autofill Failed",
  autofill_dismissed: "Autofill Dismissed",
  suspicious_domain_blocked: "Domain Blocked",
};

const ACTION_COLORS: Record<string, string> = {
  portal_created: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  portal_edited: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  portal_deactivated: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  password_revealed: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  password_rotated: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  username_copied: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  password_copied: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  portal_opened: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  open_and_fill: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  extension_matched: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  extension_reveal: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  autofill_success: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  autofill_failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  autofill_dismissed: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  suspicious_domain_blocked: "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-300",
};

function formatDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-AU", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(d: string | null) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 365) return `${Math.floor(days / 365)}y ago`;
  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  return "just now";
}

export default function PortalAccessPage() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("portals");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [formOpen, setFormOpen] = useState(false);
  const [editingPortal, setEditingPortal] = useState<Portal | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<number, string>>({});
  const [deactivateConfirm, setDeactivateConfirm] = useState<Portal | null>(null);
  const [copiedField, setCopiedField] = useState<{ id: number; field: string } | null>(null);
  const [launchPortal, setLaunchPortal] = useState<Portal | null>(null);

  const canEdit = hasPermission("portal_access.edit");
  const canReveal = hasPermission("portal_access.reveal");
  const canDelete = hasPermission("portal_access.delete");
  const canViewLogs = hasPermission("portal_access.logs");

  const { data: portals = [], isLoading } = useQuery<Portal[]>({
    queryKey: ["/api/portal-access", statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/portal-access?status=${statusFilter}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load portals");
      return res.json();
    },
  });

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ["/api/portal-access/categories"],
    queryFn: async () => {
      const res = await fetch("/api/portal-access/categories", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<AccessLog[]>({
    queryKey: ["/api/portal-access/logs"],
    queryFn: async () => {
      const res = await fetch("/api/portal-access/logs?limit=200", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeTab === "logs" && canViewLogs,
  });

  const filteredPortals = useMemo(() => {
    return portals.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || p.portalName.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q) || p.team.toLowerCase().includes(q);
      const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [portals, searchQuery, categoryFilter]);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      if (editingPortal) {
        return apiRequest("PUT", `/api/portal-access/${editingPortal.id}`, data);
      }
      return apiRequest("POST", "/api/portal-access", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal-access"] });
      setFormOpen(false);
      setEditingPortal(null);
      toast({ title: editingPortal ? "Portal updated" : "Portal added" });
    },
    onError: () => {
      toast({ title: "Failed to save portal", variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/portal-access/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal-access"] });
      setDeactivateConfirm(null);
      toast({ title: "Portal deactivated" });
    },
  });

  const showCopied = useCallback((id: number, field: string) => {
    setCopiedField({ id, field });
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const revealPassword = async (portalId: number) => {
    if (revealedPasswords[portalId] !== undefined) {
      setRevealedPasswords((prev) => {
        const next = { ...prev };
        delete next[portalId];
        return next;
      });
      return;
    }
    try {
      const res = await apiRequest("POST", `/api/portal-access/${portalId}/reveal`);
      const { password } = await res.json();
      setRevealedPasswords((prev) => ({ ...prev, [portalId]: password }));
      setTimeout(() => {
        setRevealedPasswords((prev) => {
          const next = { ...prev };
          delete next[portalId];
          return next;
        });
      }, 30000);
    } catch {
      toast({ title: "Failed to reveal password", variant: "destructive" });
    }
  };

  const copyUsername = async (portal: Portal) => {
    try {
      await navigator.clipboard.writeText(portal.username);
      showCopied(portal.id, "username");
      toast({ title: "Username copied to clipboard" });
      await apiRequest("POST", `/api/portal-access/${portal.id}/copy-username`);
    } catch {
      toast({ title: "Failed to copy username", variant: "destructive" });
    }
  };

  const copyPassword = async (portal: Portal) => {
    try {
      const res = await apiRequest("POST", `/api/portal-access/${portal.id}/copy-password`);
      const { password } = await res.json();
      await navigator.clipboard.writeText(password);
      showCopied(portal.id, "password");
      toast({ title: "Password copied to clipboard", description: "Clipboard will be cleared in 30 seconds" });
      setTimeout(async () => {
        try {
          const current = await navigator.clipboard.readText();
          if (current === password) {
            await navigator.clipboard.writeText("");
          }
        } catch {}
      }, 30000);
    } catch {
      toast({ title: "Failed to copy password", variant: "destructive" });
    }
  };

  const openAndFill = async (portal: Portal) => {
    if (!portal.portalUrl) return;
    let password = "";
    try {
      const res = await apiRequest("POST", `/api/portal-access/${portal.id}/open-and-fill`);
      const data = await res.json();
      password = data.password || "";
    } catch {
      toast({ title: "Could not retrieve credentials", description: "Opening portal without credentials.", variant: "destructive" });
      window.open(portal.portalUrl, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      await navigator.clipboard.writeText(password);
      toast({
        title: "Credentials ready — opening portal",
        description: `Username: ${portal.username} • Password copied to clipboard.`,
      });
    } catch {
      toast({
        title: "Clipboard access denied",
        description: "Could not copy password. Opening portal anyway.",
        variant: "destructive",
      });
    }
    window.open(portal.portalUrl, "_blank", "noopener,noreferrer");
  };

  const handleEdit = (portal: Portal) => {
    setEditingPortal(portal);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingPortal(null);
    setFormOpen(true);
  };

  const uniqueCategories = useMemo(() => {
    const cats = new Set(portals.map((p) => p.category).filter(Boolean));
    categories.forEach((c) => cats.add(c));
    return Array.from(cats).sort();
  }, [portals, categories]);

  return (
    <div className="p-6 space-y-6" data-testid="portal-access-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Portal Access Manager</h1>
          <p className="text-sm text-muted-foreground">Secure credential vault for university and agent portals</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1 py-1">
            <Lock className="w-3 h-3" /> Fernet Encrypted
          </Badge>
          {canEdit && (
            <Button onClick={handleAdd} data-testid="button-add-portal">
              <Plus className="w-4 h-4 mr-2" /> Add Portal
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="portals" data-testid="tab-portals">
            <Globe className="w-4 h-4 mr-1" /> Portals
          </TabsTrigger>
          {canViewLogs && (
            <TabsTrigger value="logs" data-testid="tab-logs">
              <Shield className="w-4 h-4 mr-1" /> Access Logs
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="portals" className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search portals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading portals...</div>
          ) : filteredPortals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No portals found</p>
                {canEdit && <p className="text-xs mt-1">Click "Add Portal" to create one</p>}
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Portal</TableHead>
                    <TableHead>Credentials</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Password Updated</TableHead>
                    <TableHead className="w-[140px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPortals.map((portal) => (
                    <TableRow key={portal.id} data-testid={`row-portal-${portal.id}`} className="group">
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm" data-testid={`text-portal-name-${portal.id}`}>
                              {portal.portalName}
                            </span>
                            {portal.status === "inactive" && (
                              <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                            )}
                          </div>
                          {portal.portalUrl && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {(() => { try { return new URL(portal.portalUrl).hostname; } catch { return portal.portalUrl; } })()}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {portal.username && (
                            <div className="flex items-center gap-1.5">
                              <User className="w-3 h-3 text-muted-foreground" />
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded" data-testid={`text-username-${portal.id}`}>
                                {portal.username}
                              </code>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => copyUsername(portal)}
                                    data-testid={`button-copy-username-${portal.id}`}
                                  >
                                    {copiedField?.id === portal.id && copiedField?.field === "username"
                                      ? <Check className="w-3 h-3 text-emerald-600" />
                                      : <Copy className="w-3 h-3" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy username</TooltipContent>
                              </Tooltip>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Key className="w-3 h-3 text-muted-foreground" />
                            {revealedPasswords[portal.id] !== undefined ? (
                              <>
                                <code className="text-xs bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800" data-testid={`text-password-${portal.id}`}>
                                  {revealedPasswords[portal.id]}
                                </code>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5"
                                      onClick={async () => {
                                        try {
                                          await navigator.clipboard.writeText(revealedPasswords[portal.id]);
                                          showCopied(portal.id, "password");
                                          toast({ title: "Password copied" });
                                        } catch {
                                          toast({ title: "Failed to copy", variant: "destructive" });
                                        }
                                      }}
                                      data-testid={`button-copy-password-${portal.id}`}
                                    >
                                      {copiedField?.id === portal.id && copiedField?.field === "password"
                                        ? <Check className="w-3 h-3 text-emerald-600" />
                                        : <Copy className="w-3 h-3" />}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Copy password</TooltipContent>
                                </Tooltip>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground font-mono">••••••••</span>
                            )}
                            {canReveal && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => revealPassword(portal.id)}
                                    data-testid={`button-reveal-password-${portal.id}`}
                                  >
                                    {revealedPasswords[portal.id] !== undefined
                                      ? <EyeOff className="w-3 h-3" />
                                      : <Eye className="w-3 h-3" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{revealedPasswords[portal.id] !== undefined ? "Hide password" : "Reveal password"}</TooltipContent>
                              </Tooltip>
                            )}
                            {canReveal && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => copyPassword(portal)}
                                    data-testid={`button-copy-pw-${portal.id}`}
                                  >
                                    <Clipboard className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy password to clipboard</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {portal.category ? (
                          <Badge variant="outline" className="text-xs">{portal.category}</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{portal.team || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground" title={portal.passwordUpdatedAt || ""}>
                          {portal.passwordUpdatedAt ? timeAgo(portal.passwordUpdatedAt) : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {portal.portalUrl && canReveal && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  className="h-7 px-2.5 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                                  onClick={() => openAndFill(portal)}
                                  data-testid={`button-launch-${portal.id}`}
                                >
                                  <LogIn className="w-3.5 h-3.5" />
                                  <span className="text-xs">Launch</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy password & open portal login page</TooltipContent>
                            </Tooltip>
                          )}
                          {portal.portalUrl && !canReveal && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 gap-1.5"
                                  onClick={() => {
                                    apiRequest("POST", `/api/portal-access/${portal.id}/open`);
                                    window.open(portal.portalUrl, "_blank", "noopener,noreferrer");
                                  }}
                                  data-testid={`button-open-${portal.id}`}
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span className="text-xs">Open</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Open portal in new tab</TooltipContent>
                            </Tooltip>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-actions-${portal.id}`}>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {portal.username && (
                                <DropdownMenuItem onClick={() => copyUsername(portal)} data-testid={`menu-copy-user-${portal.id}`}>
                                  <User className="w-4 h-4 mr-2" /> Copy Username
                                </DropdownMenuItem>
                              )}
                              {canReveal && (
                                <DropdownMenuItem onClick={() => copyPassword(portal)} data-testid={`menu-copy-pw-${portal.id}`}>
                                  <Clipboard className="w-4 h-4 mr-2" /> Copy Password
                                </DropdownMenuItem>
                              )}
                              {canReveal && (
                                <DropdownMenuItem onClick={() => revealPassword(portal.id)} data-testid={`menu-reveal-${portal.id}`}>
                                  <Eye className="w-4 h-4 mr-2" /> {revealedPasswords[portal.id] !== undefined ? "Hide Password" : "Reveal Password"}
                                </DropdownMenuItem>
                              )}
                              {portal.portalUrl && (
                                <>
                                  <DropdownMenuSeparator />
                                  {canReveal && (
                                    <DropdownMenuItem onClick={() => openAndFill(portal)} data-testid={`menu-launch-${portal.id}`}>
                                      <LogIn className="w-4 h-4 mr-2" /> Launch (Copy & Open)
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => {
                                    apiRequest("POST", `/api/portal-access/${portal.id}/open`);
                                    window.open(portal.portalUrl, "_blank", "noopener,noreferrer");
                                  }} data-testid={`menu-open-${portal.id}`}>
                                    <ExternalLink className="w-4 h-4 mr-2" /> Open Portal
                                  </DropdownMenuItem>
                                </>
                              )}
                              {(canEdit || canDelete) && <DropdownMenuSeparator />}
                              {canEdit && (
                                <DropdownMenuItem onClick={() => handleEdit(portal)} data-testid={`menu-edit-${portal.id}`}>
                                  <Edit className="w-4 h-4 mr-2" /> Edit Details
                                </DropdownMenuItem>
                              )}
                              {canEdit && (
                                <DropdownMenuItem onClick={() => {
                                  setEditingPortal(portal);
                                  setFormOpen(true);
                                }} data-testid={`menu-rotate-${portal.id}`}>
                                  <RotateCcw className="w-4 h-4 mr-2" /> Rotate Password
                                </DropdownMenuItem>
                              )}
                              {canDelete && portal.status === "active" && (
                                <DropdownMenuItem
                                  onClick={() => setDeactivateConfirm(portal)}
                                  className="text-red-600"
                                  data-testid={`menu-deactivate-${portal.id}`}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Deactivate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Showing {filteredPortals.length} of {portals.length} portal{portals.length !== 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Passwords encrypted at rest (Fernet)</span>
              <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> All access logged</span>
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Auto-hide after 30s</span>
            </div>
          </div>
        </TabsContent>

        {canViewLogs && (
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5" /> Access Audit Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No access logs yet</div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Portal</TableHead>
                          <TableHead>IP Address</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log) => (
                          <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                            <TableCell>
                              <span className="text-xs" title={formatDateTime(log.createdAt)}>
                                {formatDateTime(log.createdAt)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <div className="text-sm font-medium">{log.userName || "—"}</div>
                                <div className="text-xs text-muted-foreground">{log.userEmail}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] || "bg-slate-100 text-slate-800"}`}>
                                {ACTION_LABELS[log.action] || log.action}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{log.portalName || "—"}</span>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs">{log.ipAddress || "—"}</code>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground max-w-[200px] truncate block">
                                {log.note || "—"}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <PortalFormDialog
        open={formOpen}
        onOpenChange={(open) => { if (!open) { setFormOpen(false); setEditingPortal(null); } }}
        portal={editingPortal}
        categories={uniqueCategories}
        onSave={(data) => saveMutation.mutate(data)}
        isPending={saveMutation.isPending}
      />

      <Dialog open={!!deactivateConfirm} onOpenChange={() => setDeactivateConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Deactivate Portal
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate <strong>{deactivateConfirm?.portalName}</strong>?
              The credentials will be preserved but hidden from the active list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateConfirm(null)} data-testid="button-cancel-deactivate">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deactivateConfirm && deactivateMutation.mutate(deactivateConfirm.id)}
              disabled={deactivateMutation.isPending}
              data-testid="button-confirm-deactivate"
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PortalFormDialog({
  open, onOpenChange, portal, categories, onSave, isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portal: Portal | null;
  categories: string[];
  onSave: (data: Record<string, string>) => void;
  isPending: boolean;
}) {
  const [portalName, setPortalName] = useState("");
  const [portalUrl, setPortalUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [team, setTeam] = useState("");
  const [notes, setNotes] = useState("");
  const [usernameSelector, setUsernameSelector] = useState("");
  const [passwordSelector, setPasswordSelector] = useState("");
  const [submitSelector, setSubmitSelector] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showSelectors, setShowSelectors] = useState(false);

  const resetForm = () => {
    if (portal) {
      setPortalName(portal.portalName);
      setPortalUrl(portal.portalUrl);
      setUsername(portal.username);
      setPassword("");
      setCategory(portal.category);
      setCountry(portal.country);
      setTeam(portal.team);
      setNotes(portal.notes);
      setUsernameSelector(portal.usernameSelector || "");
      setPasswordSelector(portal.passwordSelector || "");
      setSubmitSelector(portal.submitSelector || "");
      setShowSelectors(!!(portal.usernameSelector || portal.passwordSelector || portal.submitSelector));
    } else {
      setPortalName("");
      setPortalUrl("");
      setUsername("");
      setPassword("");
      setCategory("");
      setCountry("");
      setTeam("");
      setNotes("");
      setUsernameSelector("");
      setPasswordSelector("");
      setSubmitSelector("");
      setShowSelectors(false);
    }
    setShowPassword(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, string> = {
      portalName, portalUrl, username, category, country, team, notes,
      usernameSelector, passwordSelector, submitSelector,
    };
    if (password) data.password = password;
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{portal ? "Edit Portal" : "Add Portal"}</DialogTitle>
          <DialogDescription>
            {portal ? "Update portal credentials and details." : "Add a new portal credential entry. Passwords are encrypted before storage."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="portalName">Portal Name *</Label>
              <Input
                id="portalName"
                value={portalName}
                onChange={(e) => setPortalName(e.target.value)}
                required
                placeholder="e.g. Monash University Agent Portal"
                data-testid="input-portal-name"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="portalUrl">Portal URL</Label>
              <Input
                id="portalUrl"
                value={portalUrl}
                onChange={(e) => setPortalUrl(e.target.value)}
                placeholder="https://..."
                data-testid="input-portal-url"
              />
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-8"
                  placeholder="Username or email"
                  data-testid="input-username"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password">{portal ? "New Password" : "Password"}</Label>
              <div className="relative">
                <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-8 pr-8"
                  placeholder={portal ? "Leave blank to keep" : "Password"}
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  data-testid="button-toggle-password-visibility"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Australia"
                data-testid="input-country"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="team">Team / Department</Label>
              <Input
                id="team"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="e.g. Admissions"
                data-testid="input-team"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Additional notes..."
                data-testid="input-notes"
              />
            </div>
          </div>

          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => setShowSelectors(!showSelectors)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-toggle-selectors"
            >
              <span>Autofill Selectors (for Chrome Extension)</span>
              <span className="text-[10px]">{showSelectors ? "Hide" : "Show"}</span>
            </button>
            {showSelectors && (
              <div className="px-3 pb-3 space-y-3 border-t">
                <p className="text-[11px] text-muted-foreground pt-2">
                  CSS selectors help the Chrome extension find the login form fields on this portal.
                  Leave blank to use automatic detection.
                </p>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label htmlFor="usernameSelector" className="text-xs">Username Field Selector</Label>
                    <Input
                      id="usernameSelector"
                      value={usernameSelector}
                      onChange={(e) => setUsernameSelector(e.target.value)}
                      placeholder='e.g. input[type="email"] or #txtUsername'
                      className="font-mono text-xs"
                      data-testid="input-username-selector"
                    />
                  </div>
                  <div>
                    <Label htmlFor="passwordSelector" className="text-xs">Password Field Selector</Label>
                    <Input
                      id="passwordSelector"
                      value={passwordSelector}
                      onChange={(e) => setPasswordSelector(e.target.value)}
                      placeholder='e.g. input[type="password"] or #txtPassword'
                      className="font-mono text-xs"
                      data-testid="input-password-selector"
                    />
                  </div>
                  <div>
                    <Label htmlFor="submitSelector" className="text-xs">Submit Button Selector</Label>
                    <Input
                      id="submitSelector"
                      value={submitSelector}
                      onChange={(e) => setSubmitSelector(e.target.value)}
                      placeholder='e.g. button[type="submit"] or #btnLogin'
                      className="font-mono text-xs"
                      data-testid="input-submit-selector"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/50 rounded px-3 py-2">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Password will be encrypted using Fernet (AES-128-CBC + HMAC) before storage. The original password is never stored in plain text.</span>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-form">
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !portalName} data-testid="button-save-portal">
              {isPending ? "Saving..." : portal ? "Update" : "Add Portal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
