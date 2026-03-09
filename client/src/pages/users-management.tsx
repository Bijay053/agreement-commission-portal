import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Users, Mail, User, Pencil, Shield, Monitor, Smartphone, Tablet, Clock, Globe, LogOut, UserCheck, UserX } from "lucide-react";
import type { Role } from "@shared/schema";

interface UserWithRoles {
  id: number;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  roles: Role[];
}

export default function UsersManagementPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [viewingSessionsUser, setViewingSessionsUser] = useState<UserWithRoles | null>(null);

  const { data: users, isLoading } = useQuery<UserWithRoles[]>({ queryKey: ["/api/users"] });
  const { data: roles } = useQuery<Role[]>({ queryKey: ["/api/roles"] });

  const [createForm, setCreateForm] = useState({
    email: "",
    fullName: "",
    password: "",
    roleId: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      setShowCreateDialog(false);
      setCreateForm({ email: "", fullName: "", password: "", roleId: "" });
      toast({ title: "User created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...createForm,
      roleId: createForm.roleId ? parseInt(createForm.roleId) : undefined,
    });
  };

  const [editRoleIds, setEditRoleIds] = useState<number[]>([]);

  const updateRolesMutation = useMutation({
    mutationFn: async ({ userId, roleIds }: { userId: number; roleIds: number[] }) => {
      const res = await apiRequest("PUT", `/api/users/${userId}/roles`, { roleIds });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      toast({ title: "Roles updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/status`, { isActive });
      return res.json();
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: variables.isActive ? "User activated" : "User deactivated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEditDialog = (user: UserWithRoles) => {
    setEditingUser(user);
    setEditRoleIds(user.roles.map(r => r.id));
  };

  const toggleRole = (roleId: number) => {
    setEditRoleIds(prev =>
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSaveRoles = () => {
    if (!editingUser) return;
    updateRolesMutation.mutate({ userId: editingUser.id, roleIds: editRoleIds });
  };

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-users-title">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage system users and role assignments</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-user">
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input value={createForm.fullName} onChange={e => setCreateForm({...createForm, fullName: e.target.value})} placeholder="John Smith" required data-testid="input-user-name" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} placeholder="john@studyinfocentre.com" required data-testid="input-user-email" />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} placeholder="Minimum 12 characters" required minLength={12} data-testid="input-user-password" />
              </div>
              <div>
                <Label>Initial Role</Label>
                <SearchableSelect
                  value={createForm.roleId}
                  onValueChange={v => setCreateForm({...createForm, roleId: v})}
                  options={(roles || []).map((r) => ({ value: String(r.id), label: r.name }))}
                  placeholder="Select role"
                  searchPlaceholder="Search roles..."
                  data-testid="select-user-role"
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-user">
                {createMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>
          ))}
        </div>
      ) : users && users.length > 0 ? (
        <div className="space-y-2">
          {users.map((user) => (
            <Card key={user.id} data-testid={`card-user-${user.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium" data-testid={`text-user-name-${user.id}`}>{user.fullName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {user.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {user.roles.length > 0 ? (
                      user.roles.map((role) => (
                        <Badge key={role.id} variant="secondary" data-testid={`badge-role-${user.id}-${role.id}`}>
                          <Shield className="w-3 h-3 mr-1" />
                          {role.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground" data-testid={`text-no-roles-${user.id}`}>No roles assigned</span>
                    )}
                    <Badge variant={user.isActive ? "default" : "destructive"} data-testid={`badge-status-${user.id}`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (user.isActive) {
                          if (confirm(`Deactivate ${user.fullName}? They will be logged out and unable to sign in.`)) {
                            toggleStatusMutation.mutate({ userId: user.id, isActive: false });
                          }
                        } else {
                          toggleStatusMutation.mutate({ userId: user.id, isActive: true });
                        }
                      }}
                      title={user.isActive ? "Deactivate account" : "Activate account"}
                      data-testid={`button-toggle-status-${user.id}`}
                    >
                      {user.isActive ? <UserX className="w-4 h-4 text-destructive" /> : <UserCheck className="w-4 h-4 text-green-600" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setViewingSessionsUser(user)}
                      title="View sessions"
                      data-testid={`button-sessions-${user.id}`}
                    >
                      <Monitor className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEditDialog(user)}
                      data-testid={`button-edit-user-${user.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No users found</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit User Roles</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{editingUser.fullName}</p>
                  <p className="text-xs text-muted-foreground">{editingUser.email}</p>
                </div>
              </div>

              <div className="flex-1 min-h-0 flex flex-col">
                <Label className="mb-2 block shrink-0">Assign Roles</Label>
                <div className="space-y-2 overflow-y-auto flex-1 min-h-0 max-h-[50vh] pr-1">
                  {roles?.map((role) => (
                    <div
                      key={role.id}
                      className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover-elevate"
                      onClick={() => toggleRole(role.id)}
                      data-testid={`checkbox-role-${role.id}`}
                    >
                      <Checkbox
                        checked={editRoleIds.includes(role.id)}
                        onCheckedChange={() => toggleRole(role.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{role.name}</p>
                        {role.description && (
                          <p className="text-xs text-muted-foreground">{role.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!roles || roles.length === 0) && (
                    <p className="text-sm text-muted-foreground">No roles available</p>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              onClick={handleSaveRoles}
              disabled={updateRolesMutation.isPending}
              data-testid="button-save-roles"
            >
              {updateRolesMutation.isPending ? "Saving..." : "Save Roles"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingSessionsUser} onOpenChange={(open) => { if (!open) setViewingSessionsUser(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Session History - {viewingSessionsUser?.fullName}</DialogTitle>
          </DialogHeader>
          {viewingSessionsUser && <UserSessionsPanel userId={viewingSessionsUser.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserSessionsPanel({ userId }: { userId: number }) {
  const { toast } = useToast();

  const { data: sessions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users", userId, "sessions"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/sessions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
  });

  const { data: securityLogs } = useQuery<any[]>({
    queryKey: ["/api/admin/users", userId, "security-logs"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/security-logs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
  });

  const getDeviceIcon = (type: string) => {
    if (type === "mobile") return <Smartphone className="w-4 h-4" />;
    if (type === "tablet") return <Tablet className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const activeSessions = sessions?.filter(s => s.isActive) || [];
  const recentSessions = sessions?.filter(s => !s.isActive).slice(0, 15) || [];

  return (
    <div className="space-y-4" data-testid="admin-sessions-panel">
      <div>
        <h3 className="text-sm font-medium mb-2">Active Sessions ({activeSessions.length})</h3>
        {activeSessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active sessions</p>
        ) : (
          <div className="space-y-2">
            {activeSessions.map((session: any) => (
              <div key={session.id} className="flex items-center justify-between p-2 border rounded text-sm" data-testid={`admin-session-${session.id}`}>
                <div className="flex items-center gap-2">
                  {getDeviceIcon(session.deviceType)}
                  <div>
                    <span className="text-xs font-medium">{session.browser} on {session.os}</span>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Globe className="w-2.5 h-2.5" />{session.ipAddress}</span>
                      <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{formatDate(session.lastActivityAt)}</span>
                    </div>
                  </div>
                </div>
                <Badge variant="default" className="text-[10px]">Active</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {recentSessions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Recent Sessions</h3>
          <div className="space-y-1">
            {recentSessions.map((session: any) => (
              <div key={session.id} className="flex items-center justify-between p-1.5 border rounded text-xs opacity-70">
                <div className="flex items-center gap-2">
                  {getDeviceIcon(session.deviceType)}
                  <span>{session.browser} on {session.os}</span>
                  <span className="text-muted-foreground">{session.ipAddress}</span>
                </div>
                <div className="flex items-center gap-2">
                  {session.logoutReason && (
                    <Badge variant="outline" className="text-[10px]">{session.logoutReason}</Badge>
                  )}
                  <span className="text-muted-foreground">{formatDate(session.loginAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {securityLogs && securityLogs.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Security Activity</h3>
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {securityLogs.slice(0, 30).map((log: any) => (
              <div key={log.id} className="flex items-center justify-between py-1 px-2 text-[11px] border-b last:border-0">
                <span className="font-medium">{log.eventType}</span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {log.ipAddress && <span>{log.ipAddress}</span>}
                  <span>{formatDate(log.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
