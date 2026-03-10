import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Users, Trash2, Mail, Phone, MapPin, Star, Pencil, UserPlus } from "lucide-react";

export default function ContactsTab({ agreementId }: { agreementId: number }) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canCreate = hasPermission("contacts.create");
  const canEdit = hasPermission("contacts.edit");
  const canDelete = hasPermission("contacts.delete");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [deletingContact, setDeletingContact] = useState<any | null>(null);

  const contactsQueryKey = `/api/agreements/${agreementId}/contacts`;

  const { data: contacts, isLoading } = useQuery<any[]>({
    queryKey: [contactsQueryKey],
  });

  const { data: countries } = useQuery<any[]>({ queryKey: ["/api/countries"] });

  const emptyForm = {
    fullName: "",
    positionTitle: "",
    phone: "",
    email: "",
    countryId: "",
    city: "",
    isPrimary: false,
    notes: "",
  };

  const [addForm, setAddForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/agreements/${agreementId}/contacts`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [contactsQueryKey] });
      setShowAddDialog(false);
      setAddForm(emptyForm);
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
      queryClient.invalidateQueries({ queryKey: [contactsQueryKey] });
      setEditingContact(null);
      toast({ title: "Contact updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [contactsQueryKey] });
      setDeletingContact(null);
      toast({ title: "Contact deleted" });
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.countryId) return;
    createMutation.mutate({
      ...addForm,
      countryId: parseInt(addForm.countryId),
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact || !editForm.countryId) return;
    updateMutation.mutate({
      id: editingContact.id,
      data: {
        ...editForm,
        countryId: editForm.countryId ? parseInt(editForm.countryId) : null,
      },
    });
  };

  const openEditDialog = (contact: any) => {
    setEditForm({
      fullName: contact.fullName,
      positionTitle: contact.positionTitle || "",
      phone: contact.phone || "",
      email: contact.email || "",
      countryId: contact.countryId ? String(contact.countryId) : "",
      city: contact.city || "",
      isPrimary: contact.isPrimary || false,
      notes: contact.notes || "",
    });
    setEditingContact(contact);
  };

  const getCountryName = (countryId: number | null) => {
    if (!countryId || !countries) return null;
    const c = countries.find((c: any) => c.id === countryId);
    return c?.name || null;
  };

  if (isLoading) return <div className="space-y-3">{Array.from({length: 2}).map((_,i) => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Provider Contacts</h3>
        {canCreate && (
          <Button size="sm" onClick={() => setShowAddDialog(true)} data-testid="button-add-contact">
            <UserPlus className="w-4 h-4 mr-1" /> Add Contact
          </Button>
        )}
      </div>

      {contacts && contacts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {contacts.map((contact: any) => (
            <Card key={contact.id} data-testid={`card-contact-${contact.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-medium">{contact.fullName}</h4>
                      {contact.isPrimary && (
                        <Badge variant="default" className="text-xs">
                          <Star className="w-3 h-3 mr-1" /> Primary
                        </Badge>
                      )}
                    </div>
                    {contact.positionTitle && (
                      <p className="text-xs text-muted-foreground mt-0.5">{contact.positionTitle}</p>
                    )}
                    <div className="mt-2 space-y-1">
                      {contact.email && (
                        <p className="text-xs flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="w-3 h-3" /> {contact.email}
                        </p>
                      )}
                      {contact.phone && (
                        <p className="text-xs flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="w-3 h-3" /> {contact.phone}
                        </p>
                      )}
                      {(contact.countryId || contact.city) && (
                        <p className="text-xs flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {[getCountryName(contact.countryId), contact.city].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  {(canEdit || canDelete) && (
                    <div className="flex items-center gap-1 shrink-0">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="cursor-pointer"
                          onClick={() => openEditDialog(contact)}
                          data-testid={`button-edit-contact-${contact.id}`}
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="cursor-pointer"
                          onClick={() => setDeletingContact(contact)}
                          data-testid={`button-delete-contact-${contact.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No contacts added</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showAddDialog} onOpenChange={(open) => { if (open) setAddForm(emptyForm); setShowAddDialog(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Full Name <span className="text-red-500">*</span></Label>
                <Input value={addForm.fullName} onChange={e => setAddForm({...addForm, fullName: e.target.value})} placeholder="Dr. John Smith" required data-testid="input-contact-name" />
              </div>
              <div>
                <Label>Position</Label>
                <Input value={addForm.positionTitle} onChange={e => setAddForm({...addForm, positionTitle: e.target.value})} placeholder="Partnerships Manager" data-testid="input-contact-position" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input type="email" value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} placeholder="john@university.edu" data-testid="input-contact-email" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input type="tel" value={addForm.phone} onChange={e => { const v = e.target.value; if (v === '' || /^[\d\s\+\-\(\)\.]+$/.test(v)) setAddForm({...addForm, phone: v}); }} placeholder="+61 2 1234 5678" data-testid="input-contact-phone" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contact Country <span className="text-red-500">*</span></Label>
                <SearchableSelect
                  value={addForm.countryId}
                  onValueChange={v => setAddForm({...addForm, countryId: v})}
                  options={(countries || []).map((c: any) => ({ value: String(c.id), label: c.name }))}
                  placeholder="Select country"
                  searchPlaceholder="Search countries..."
                  data-testid="select-contact-country"
                />
              </div>
              <div>
                <Label>City / State</Label>
                <Input value={addForm.city} onChange={e => setAddForm({...addForm, city: e.target.value})} placeholder="e.g. Melbourne, VIC" data-testid="input-contact-city" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={addForm.isPrimary} onCheckedChange={v => setAddForm({...addForm, isPrimary: v})} data-testid="switch-primary-contact" />
              <Label>Primary Contact</Label>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={addForm.notes} onChange={e => setAddForm({...addForm, notes: e.target.value})} placeholder="Additional notes..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button type="submit" className="w-full" disabled={createMutation.isPending || !addForm.countryId} data-testid="button-submit-contact">
                {createMutation.isPending ? "Adding..." : "Add Contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingContact} onOpenChange={(open) => { if (!open) setEditingContact(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Full Name <span className="text-red-500">*</span></Label>
                <Input value={editForm.fullName} onChange={e => setEditForm({...editForm, fullName: e.target.value})} required data-testid="input-edit-contact-name" />
              </div>
              <div>
                <Label>Position</Label>
                <Input value={editForm.positionTitle} onChange={e => setEditForm({...editForm, positionTitle: e.target.value})} data-testid="input-edit-contact-position" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} data-testid="input-edit-contact-email" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input type="tel" value={editForm.phone} onChange={e => { const v = e.target.value; if (v === '' || /^[\d\s\+\-\(\)\.]+$/.test(v)) setEditForm({...editForm, phone: v}); }} data-testid="input-edit-contact-phone" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contact Country <span className="text-red-500">*</span></Label>
                <SearchableSelect
                  value={editForm.countryId}
                  onValueChange={v => setEditForm({...editForm, countryId: v})}
                  options={(countries || []).map((c: any) => ({ value: String(c.id), label: c.name }))}
                  placeholder="Select country"
                  searchPlaceholder="Search countries..."
                  data-testid="select-edit-contact-country"
                />
              </div>
              <div>
                <Label>City / State</Label>
                <Input value={editForm.city} onChange={e => setEditForm({...editForm, city: e.target.value})} placeholder="e.g. Melbourne, VIC" data-testid="input-edit-contact-city" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={editForm.isPrimary} onCheckedChange={v => setEditForm({...editForm, isPrimary: v})} data-testid="switch-edit-primary-contact" />
              <Label>Primary Contact</Label>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} data-testid="input-edit-contact-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingContact(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending || !editForm.countryId} data-testid="button-submit-edit-contact">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingContact} onOpenChange={(open) => { if (!open) setDeletingContact(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingContact?.fullName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingContact && deleteMutation.mutate(deletingContact.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-contact"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
