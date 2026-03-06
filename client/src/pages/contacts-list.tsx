import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Users, Mail, Phone, MapPin, Star, Filter, Globe, Building2,
  MoreHorizontal, Eye, Pencil, Trash2, Plus, UserPlus,
} from "lucide-react";
import { AGREEMENT_STATUSES } from "@shared/schema";

interface ContactRow {
  id: number;
  fullName: string;
  positionTitle: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean | null;
  notes: string | null;
  contactCountryId: number | null;
  contactCountryName: string | null;
  agreementId: number;
  agreementCode: string;
  agreementTitle: string;
  agreementStatus: string;
  providerId: number;
  providerName: string;
  providerType: string;
  providerCountryId: number | null;
  providerCountryName: string | null;
  territoryCountries: string[];
  createdAt: string | null;
}

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: "Active", variant: "default" },
    draft: { label: "Draft", variant: "secondary" },
    expired: { label: "Expired", variant: "destructive" },
    terminated: { label: "Terminated", variant: "destructive" },
    renewal_in_progress: { label: "Renewal in Progress", variant: "outline" },
  };
  const s = map[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export default function ContactsListPage() {
  const [, navigate] = useLocation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = hasPermission("contacts.manage");

  const [search, setSearch] = useState("");
  const [providerCountryFilter, setProviderCountryFilter] = useState("all");
  const [contactCountryFilter, setContactCountryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [editContact, setEditContact] = useState<ContactRow | null>(null);
  const [deleteContact, setDeleteContact] = useState<ContactRow | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({
    agreementId: "",
    fullName: "",
    positionTitle: "",
    phone: "",
    email: "",
    countryId: "",
    isPrimary: false,
    notes: "",
  });
  const [editForm, setEditForm] = useState({
    fullName: "",
    positionTitle: "",
    phone: "",
    email: "",
    countryId: "",
    isPrimary: false,
    notes: "",
  });

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("q", search);
  if (providerCountryFilter !== "all") queryParams.set("providerCountryId", providerCountryFilter);
  if (contactCountryFilter !== "all") queryParams.set("contactCountryId", contactCountryFilter);
  if (statusFilter !== "all") queryParams.set("agreementStatus", statusFilter);
  const queryString = queryParams.toString();
  const contactsUrl = `/api/contacts${queryString ? `?${queryString}` : ""}`;

  const { data: contacts, isLoading } = useQuery<ContactRow[]>({
    queryKey: [contactsUrl],
  });

  const { data: countries } = useQuery<any[]>({ queryKey: ["/api/countries"] });
  const { data: agreementsList } = useQuery<any[]>({ queryKey: ["/api/agreements"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/agreements/${data.agreementId}/contacts`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [contactsUrl] });
      setShowAddDialog(false);
      setAddForm({ agreementId: "", fullName: "", positionTitle: "", phone: "", email: "", countryId: "", isPrimary: false, notes: "" });
      toast({ title: "Contact added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/contacts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [contactsUrl] });
      setEditContact(null);
      toast({ title: "Contact updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [contactsUrl] });
      setDeleteContact(null);
      toast({ title: "Contact deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEditDialog = (contact: ContactRow) => {
    setEditForm({
      fullName: contact.fullName,
      positionTitle: contact.positionTitle || "",
      phone: contact.phone || "",
      email: contact.email || "",
      countryId: contact.contactCountryId ? String(contact.contactCountryId) : "",
      isPrimary: contact.isPrimary || false,
      notes: contact.notes || "",
    });
    setEditContact(contact);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editContact) return;
    updateMutation.mutate({
      id: editContact.id,
      data: {
        ...editForm,
        countryId: editForm.countryId ? parseInt(editForm.countryId) : null,
      },
    });
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-contacts-title">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">All agreement contacts across providers</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-contact">
            <UserPlus className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts, providers, agreements..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-contacts"
              />
            </div>
            <Select value={providerCountryFilter} onValueChange={setProviderCountryFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-provider-country-filter">
                <MapPin className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Provider Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Provider Countries</SelectItem>
                {countries?.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={contactCountryFilter} onValueChange={setContactCountryFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-contact-country-filter">
                <Globe className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Contact Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contact Countries</SelectItem>
                {countries?.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[170px]" data-testid="select-status-filter">
                <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Agreement Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {AGREEMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : contacts && contacts.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Provider Country</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-center">Primary</TableHead>
                  <TableHead>Agreement Status</TableHead>
                  {canManage && <TableHead className="w-[60px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow
                    key={contact.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/agreements/${contact.agreementId}?tab=contacts`)}
                    data-testid={`row-contact-${contact.id}`}
                  >
                    <TableCell>
                      <span className="font-medium text-sm" data-testid={`text-contact-name-${contact.id}`}>
                        {contact.fullName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {contact.positionTitle || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm">{contact.providerName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {contact.providerCountryName || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {contact.territoryCountries.length > 0
                          ? contact.territoryCountries.join(", ")
                          : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {contact.email ? (
                        <span className="text-sm flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          {contact.email}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.phone ? (
                        <span className="text-sm flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          {contact.phone}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {contact.isPrimary && (
                        <Badge variant="default" data-testid={`badge-primary-${contact.id}`}>
                          <Star className="w-3 h-3 mr-1" /> Primary
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(contact.agreementStatus)}
                    </TableCell>
                    {canManage && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-contact-actions-${contact.id}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate(`/agreements/${contact.agreementId}?tab=contacts`)}
                              data-testid={`button-view-contact-${contact.id}`}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Agreement
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openEditDialog(contact)}
                              data-testid={`button-edit-contact-${contact.id}`}
                            >
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteContact(contact)}
                              className="text-destructive"
                              data-testid={`button-delete-contact-${contact.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-medium">No contacts found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search || providerCountryFilter !== "all" || contactCountryFilter !== "all" || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Contacts will appear here once added to agreements"}
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editContact} onOpenChange={(open) => { if (!open) setEditContact(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Full Name <span className="text-red-500">*</span></Label>
                <Input
                  value={editForm.fullName}
                  onChange={e => setEditForm({ ...editForm, fullName: e.target.value })}
                  required
                  data-testid="input-edit-contact-name"
                />
              </div>
              <div>
                <Label>Position</Label>
                <Input
                  value={editForm.positionTitle}
                  onChange={e => setEditForm({ ...editForm, positionTitle: e.target.value })}
                  data-testid="input-edit-contact-position"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  data-testid="input-edit-contact-email"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  data-testid="input-edit-contact-phone"
                />
              </div>
            </div>
            <div>
              <Label>Country</Label>
              <Select value={editForm.countryId} onValueChange={v => setEditForm({ ...editForm, countryId: v })}>
                <SelectTrigger data-testid="select-edit-contact-country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countries?.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={editForm.isPrimary}
                onCheckedChange={v => setEditForm({ ...editForm, isPrimary: v })}
                data-testid="switch-edit-primary-contact"
              />
              <Label>Primary Contact</Label>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                data-testid="input-edit-contact-notes"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditContact(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit-contact">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteContact} onOpenChange={(open) => { if (!open) setDeleteContact(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteContact?.fullName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteContact && deleteMutation.mutate(deleteContact.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-contact"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!addForm.agreementId) return;
              createMutation.mutate({
                ...addForm,
                agreementId: parseInt(addForm.agreementId),
                countryId: addForm.countryId ? parseInt(addForm.countryId) : null,
              });
            }}
            className="space-y-4"
          >
            <div>
              <Label>Agreement <span className="text-red-500">*</span></Label>
              <Select value={addForm.agreementId} onValueChange={v => setAddForm({ ...addForm, agreementId: v })}>
                <SelectTrigger data-testid="select-add-contact-agreement">
                  <SelectValue placeholder="Select agreement" />
                </SelectTrigger>
                <SelectContent>
                  {agreementsList?.map((a: any) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.agreementCode} — {a.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Full Name <span className="text-red-500">*</span></Label>
                <Input
                  value={addForm.fullName}
                  onChange={e => setAddForm({ ...addForm, fullName: e.target.value })}
                  required
                  data-testid="input-add-contact-name"
                />
              </div>
              <div>
                <Label>Position</Label>
                <Input
                  value={addForm.positionTitle}
                  onChange={e => setAddForm({ ...addForm, positionTitle: e.target.value })}
                  data-testid="input-add-contact-position"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={addForm.email}
                  onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                  data-testid="input-add-contact-email"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={addForm.phone}
                  onChange={e => setAddForm({ ...addForm, phone: e.target.value })}
                  data-testid="input-add-contact-phone"
                />
              </div>
            </div>
            <div>
              <Label>Country</Label>
              <Select value={addForm.countryId} onValueChange={v => setAddForm({ ...addForm, countryId: v })}>
                <SelectTrigger data-testid="select-add-contact-country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countries?.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={addForm.isPrimary}
                onCheckedChange={v => setAddForm({ ...addForm, isPrimary: v })}
                data-testid="switch-add-primary-contact"
              />
              <Label>Primary Contact</Label>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={addForm.notes}
                onChange={e => setAddForm({ ...addForm, notes: e.target.value })}
                data-testid="input-add-contact-notes"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || !addForm.agreementId} data-testid="button-submit-add-contact">
                {createMutation.isPending ? "Adding..." : "Add Contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
