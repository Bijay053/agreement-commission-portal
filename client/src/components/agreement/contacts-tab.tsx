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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Users, Trash2, Mail, Phone, MapPin, Star } from "lucide-react";

export default function ContactsTab({ agreementId }: { agreementId: number }) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = hasPermission("contacts.manage");
  const [showDialog, setShowDialog] = useState(false);

  const { data: contacts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/agreements", agreementId, "contacts"],
    queryFn: async () => {
      const res = await fetch(`/api/agreements/${agreementId}/contacts`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: countries } = useQuery<any[]>({ queryKey: ["/api/countries"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/agreements/${agreementId}/contacts`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreements", agreementId, "contacts"] });
      setShowDialog(false);
      toast({ title: "Contact added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreements", agreementId, "contacts"] });
      toast({ title: "Contact deleted" });
    },
  });

  const [form, setForm] = useState({
    fullName: "",
    positionTitle: "",
    phone: "",
    email: "",
    countryId: "",
    isPrimary: false,
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      countryId: form.countryId ? parseInt(form.countryId) : null,
    });
  };

  if (isLoading) return <div className="space-y-3">{Array.from({length: 2}).map((_,i) => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">University Contacts</h3>
        {canManage && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-contact">
                <Plus className="w-4 h-4 mr-1" /> Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Contact</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Full Name</Label>
                    <Input value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} placeholder="Dr. John Smith" required data-testid="input-contact-name" />
                  </div>
                  <div>
                    <Label>Position</Label>
                    <Input value={form.positionTitle} onChange={e => setForm({...form, positionTitle: e.target.value})} placeholder="Partnerships Manager" data-testid="input-contact-position" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="john@university.edu" data-testid="input-contact-email" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+61 2 1234 5678" data-testid="input-contact-phone" />
                  </div>
                </div>
                <div>
                  <Label>Country</Label>
                  <Select value={form.countryId} onValueChange={v => setForm({...form, countryId: v})}>
                    <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent>
                      {countries?.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.isPrimary} onCheckedChange={v => setForm({...form, isPrimary: v})} data-testid="switch-primary-contact" />
                  <Label>Primary Contact</Label>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Additional notes..." />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-contact">
                  {createMutation.isPending ? "Adding..." : "Add Contact"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {contacts && contacts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {contacts.map((contact: any) => (
            <Card key={contact.id} data-testid={`card-contact-${contact.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
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
                    </div>
                  </div>
                  {canManage && (
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(contact.id)} data-testid={`button-delete-contact-${contact.id}`}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
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
    </div>
  );
}
