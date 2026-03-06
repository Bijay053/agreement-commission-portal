import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, MoreHorizontal, Pencil, Copy, Trash2, KeyRound, Users, Eye, ShieldCheck,
} from "lucide-react";

interface PermissionAction {
  action: string;
  code: string;
  permissionId: number | null;
  description: string;
}

interface PermissionResource {
  resource: string;
  label: string;
  actions: PermissionAction[];
}

interface PermissionModule {
  module: string;
  label: string;
  resources: PermissionResource[];
}

interface PermissionSchema {
  modules: PermissionModule[];
}

interface RoleWithCount {
  id: number;
  name: string;
  description: string | null;
  userCount: number;
}

export default function RolesManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingRole, setEditingRole] = useState<RoleWithCount | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<RoleWithCount | null>(null);
  const [showPermissionEditor, setShowPermissionEditor] = useState<RoleWithCount | null>(null);
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<number>>(new Set());
  const [activeModule, setActiveModule] = useState<string>("");

  const { data: roles, isLoading: rolesLoading } = useQuery<RoleWithCount[]>({
    queryKey: ["/api/roles"],
  });

  const { data: permissionSchema } = useQuery<PermissionSchema>({
    queryKey: ["/api/admin/permissions/schema"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await apiRequest("POST", "/api/roles", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setShowCreateDialog(false);
      setCreateForm({ name: "", description: "" });
      toast({ title: "Role created successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string; description: string } }) => {
      const res = await apiRequest("PATCH", `/api/roles/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setEditingRole(null);
      toast({ title: "Role updated successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setShowDeleteDialog(null);
      toast({ title: "Role deleted successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/roles/${id}/duplicate`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({ title: "Role duplicated successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const savePermissionsMutation = useMutation({
    mutationFn: async ({ roleId, permissionIds }: { roleId: number; permissionIds: number[] }) => {
      await apiRequest("PUT", `/api/roles/${roleId}/permissions`, { permissionIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setShowPermissionEditor(null);
      toast({ title: "Permissions updated successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const allPermissionIds = useMemo(() => {
    if (!permissionSchema) return new Set<number>();
    const ids = new Set<number>();
    permissionSchema.modules.forEach(mod =>
      mod.resources.forEach(res =>
        res.actions.forEach(act => {
          if (act.permissionId) ids.add(act.permissionId);
        })
      )
    );
    return ids;
  }, [permissionSchema]);

  const openPermissionEditor = useCallback(async (role: RoleWithCount) => {
    try {
      const res = await apiRequest("GET", `/api/roles/${role.id}/permissions`);
      const permIds: number[] = await res.json();
      setSelectedPermissionIds(new Set(permIds));
      setActiveModule(permissionSchema?.modules[0]?.module || "");
      setShowPermissionEditor(role);
    } catch (err: any) {
      toast({ title: "Error loading permissions", description: err.message, variant: "destructive" });
    }
  }, [permissionSchema, toast]);

  const togglePermission = (permId: number) => {
    setSelectedPermissionIds(prev => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const toggleResourceAll = (resource: PermissionResource) => {
    const resourcePermIds = resource.actions.filter(a => a.permissionId).map(a => a.permissionId!);
    const allSelected = resourcePermIds.every(id => selectedPermissionIds.has(id));
    setSelectedPermissionIds(prev => {
      const next = new Set(prev);
      resourcePermIds.forEach(id => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const selectAllModule = (mod: PermissionModule) => {
    setSelectedPermissionIds(prev => {
      const next = new Set(prev);
      mod.resources.forEach(res =>
        res.actions.forEach(act => {
          if (act.permissionId) next.add(act.permissionId);
        })
      );
      return next;
    });
  };

  const clearAllModule = (mod: PermissionModule) => {
    setSelectedPermissionIds(prev => {
      const next = new Set(prev);
      mod.resources.forEach(res =>
        res.actions.forEach(act => {
          if (act.permissionId) next.delete(act.permissionId);
        })
      );
      return next;
    });
  };

  const applyPreset = (preset: "read_only" | "full_access") => {
    if (!permissionSchema) return;
    if (preset === "full_access") {
      setSelectedPermissionIds(new Set(allPermissionIds));
    } else {
      const readIds = new Set<number>();
      permissionSchema.modules.forEach(mod =>
        mod.resources.forEach(res =>
          res.actions.forEach(act => {
            if (act.permissionId && (act.action === "read" || act.action === "list" || act.action === "view_in_portal")) {
              readIds.add(act.permissionId);
            }
          })
        )
      );
      setSelectedPermissionIds(readIds);
    }
  };

  const currentModule = permissionSchema?.modules.find(m => m.module === activeModule);

  const getModulePermCount = (mod: PermissionModule) => {
    let total = 0;
    let selected = 0;
    mod.resources.forEach(res =>
      res.actions.forEach(act => {
        if (act.permissionId) {
          total++;
          if (selectedPermissionIds.has(act.permissionId)) selected++;
        }
      })
    );
    return { total, selected };
  };

  if (rolesLoading) {
    return (
      <div className="p-6 space-y-5 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-roles-title">Role Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage roles and their permissions</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-add-role">
          <Plus className="w-4 h-4 mr-2" />
          Add Role
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles?.map(role => (
                <TableRow key={role.id} data-testid={`row-role-${role.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium" data-testid={`text-role-name-${role.id}`}>{role.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground" data-testid={`text-role-desc-${role.id}`}>
                      {role.description || "No description"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" data-testid={`badge-role-users-${role.id}`}>
                      <Users className="w-3 h-3 mr-1" />
                      {role.userCount}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-role-actions-${role.id}`}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditForm({ name: role.name, description: role.description || "" });
                            setEditingRole(role);
                          }}
                          data-testid={`button-edit-role-${role.id}`}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openPermissionEditor(role)}
                          data-testid={`button-edit-permissions-${role.id}`}
                        >
                          <ShieldCheck className="w-4 h-4 mr-2" />
                          Edit Permissions
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => duplicateMutation.mutate(role.id)}
                          data-testid={`button-duplicate-role-${role.id}`}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setShowDeleteDialog(role)}
                          className="text-destructive"
                          data-testid={`button-delete-role-${role.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {(!roles || roles.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No roles found. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(createForm);
            }}
            className="space-y-4"
          >
            <div>
              <Label>Role Name <span className="text-red-500">*</span></Label>
              <Input
                value={createForm.name}
                onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g. Regional Manager"
                required
                data-testid="input-create-role-name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={createForm.description}
                onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Describe this role's purpose..."
                data-testid="input-create-role-description"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create-role">
                {createMutation.isPending ? "Creating..." : "Create Role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingRole} onOpenChange={(open) => { if (!open) setEditingRole(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingRole) updateMutation.mutate({ id: editingRole.id, data: editForm });
            }}
            className="space-y-4"
          >
            <div>
              <Label>Role Name <span className="text-red-500">*</span></Label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                required
                data-testid="input-edit-role-name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                data-testid="input-edit-role-description"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingRole(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit-role">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!showDeleteDialog} onOpenChange={(open) => { if (!open) setShowDeleteDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{showDeleteDialog?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteDialog && deleteMutation.mutate(showDeleteDialog.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-role"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!showPermissionEditor}
        onOpenChange={(open) => { if (!open) setShowPermissionEditor(null); }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Edit Permissions &mdash; {showPermissionEditor?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground mr-2">Presets:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("read_only")}
              data-testid="button-preset-read-only"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              Read Only
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("full_access")}
              data-testid="button-preset-full-access"
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
              Full Access
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">
              {selectedPermissionIds.size} of {allPermissionIds.size} permissions selected
            </span>
          </div>

          <div className="flex flex-1 min-h-0 border rounded-md overflow-hidden">
            <div className="w-48 shrink-0 border-r bg-muted/30 overflow-y-auto">
              {permissionSchema?.modules.map(mod => {
                const { total, selected } = getModulePermCount(mod);
                return (
                  <button
                    key={mod.module}
                    onClick={() => setActiveModule(mod.module)}
                    className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-1 transition-colors ${
                      activeModule === mod.module
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover-elevate"
                    }`}
                    data-testid={`button-module-${mod.module}`}
                  >
                    <span className="truncate">{mod.label}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {selected}/{total}
                    </Badge>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto">
              {currentModule && (
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                    <h3 className="font-medium text-sm">{currentModule.label}</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectAllModule(currentModule)}
                        data-testid={`button-select-all-${currentModule.module}`}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => clearAllModule(currentModule)}
                        data-testid={`button-clear-all-${currentModule.module}`}
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {currentModule.resources.map(resource => {
                      const resourcePermIds = resource.actions.filter(a => a.permissionId).map(a => a.permissionId!);
                      const allResourceSelected = resourcePermIds.length > 0 && resourcePermIds.every(id => selectedPermissionIds.has(id));
                      const someResourceSelected = resourcePermIds.some(id => selectedPermissionIds.has(id));

                      return (
                        <Card key={resource.resource}>
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3 mb-2">
                              <Checkbox
                                checked={allResourceSelected ? true : someResourceSelected ? "indeterminate" : false}
                                onCheckedChange={() => toggleResourceAll(resource)}
                                data-testid={`checkbox-resource-all-${resource.resource}`}
                              />
                              <span className="font-medium text-sm">{resource.label}</span>
                              <span className="text-xs text-muted-foreground">All</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 ml-7">
                              {resource.actions.map(action => (
                                <label
                                  key={action.action}
                                  className="flex items-center gap-2 text-sm cursor-pointer"
                                  data-testid={`label-permission-${resource.resource}-${action.action}`}
                                >
                                  <Checkbox
                                    checked={action.permissionId ? selectedPermissionIds.has(action.permissionId) : false}
                                    onCheckedChange={() => action.permissionId && togglePermission(action.permissionId)}
                                    disabled={!action.permissionId}
                                    data-testid={`checkbox-permission-${resource.resource}-${action.action}`}
                                  />
                                  <span className={!action.permissionId ? "text-muted-foreground" : ""}>
                                    {action.action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermissionEditor(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (showPermissionEditor) {
                  savePermissionsMutation.mutate({
                    roleId: showPermissionEditor.id,
                    permissionIds: Array.from(selectedPermissionIds),
                  });
                }
              }}
              disabled={savePermissionsMutation.isPending}
              data-testid="button-save-permissions"
            >
              {savePermissionsMutation.isPending ? "Saving..." : "Save Permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
