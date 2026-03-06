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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Users, Mail, User, Pencil, Shield } from "lucide-react";
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
                <Select value={createForm.roleId} onValueChange={v => setCreateForm({...createForm, roleId: v})}>
                  <SelectTrigger data-testid="select-user-role"><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {roles?.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <Badge variant={user.isActive ? "default" : "secondary"} data-testid={`badge-status-${user.id}`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Roles</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{editingUser.fullName}</p>
                  <p className="text-xs text-muted-foreground">{editingUser.email}</p>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Assign Roles</Label>
                <div className="space-y-2">
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
    </div>
  );
}
