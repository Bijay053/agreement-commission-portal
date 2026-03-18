import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Users } from "lucide-react";

interface Employee {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  citizenshipNo: string;
  panNo: string;
  permanentAddress: string;
  joinDate: string | null;
  status: string;
  createdAt: string;
}

async function apiRequest(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json();
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  inactive: "bg-gray-100 text-gray-800",
  terminated: "bg-red-100 text-red-800",
};

export default function EmployeesListPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", position: "", department: "" });

  const { data, isLoading } = useQuery<{ results?: Employee[] }>({
    queryKey: ["/api/employees", search],
    queryFn: () => apiRequest(`/api/employees${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });

  const employees: Employee[] = data?.results || (Array.isArray(data) ? data : []);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      apiRequest("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (newEmp: Employee) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setShowAdd(false);
      setForm({ fullName: "", email: "", phone: "", position: "", department: "" });
      toast({ title: "Employee created" });
      navigate(`/employees/${newEmp.id}`);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto" data-testid="page-employees">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-employees-title">Employees</h1>
          <p className="text-sm text-muted-foreground mt-1">{employees.length} employee{employees.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} data-testid="button-add-employee">
          <Plus className="w-4 h-4 mr-1" /> Add Employee
        </Button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-employees"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No employees found</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-medium">Email</th>
                <th className="text-left px-4 py-2.5 font-medium">Position</th>
                <th className="text-left px-4 py-2.5 font-medium">Department</th>
                <th className="text-left px-4 py-2.5 font-medium">Join Date</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr
                  key={emp.id}
                  className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/employees/${emp.id}`)}
                  data-testid={`row-employee-${emp.id}`}
                >
                  <td className="px-4 py-3 font-medium">{emp.fullName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.email}</td>
                  <td className="px-4 py-3">{emp.position}</td>
                  <td className="px-4 py-3">{emp.department}</td>
                  <td className="px-4 py-3">{emp.joinDate || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] ${STATUS_COLORS[emp.status] || "bg-gray-100 text-gray-800"}`}>
                      {emp.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Full Name *</label>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} data-testid="input-emp-name" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Email *</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="input-emp-email" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Position</label>
                <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} data-testid="input-emp-position" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Department</label>
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} data-testid="input-emp-department" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Phone</label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-emp-phone" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.fullName.trim() || !form.email.trim() || createMutation.isPending}
              data-testid="button-submit-employee"
            >
              {createMutation.isPending ? "Creating..." : "Create Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
