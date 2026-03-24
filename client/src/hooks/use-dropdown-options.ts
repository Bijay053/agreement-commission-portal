import { useQuery } from "@tanstack/react-query";

interface DropdownOption {
  id: number;
  value: string;
  label: string;
  sortOrder: number;
}

type DropdownOptionsMap = Record<string, DropdownOption[]>;

export function useDropdownOptions() {
  const { data, isLoading } = useQuery<DropdownOptionsMap>({
    queryKey: ["/api/dropdown-options"],
    queryFn: async () => {
      const res = await fetch("/api/dropdown-options", { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 60000,
  });

  return { options: data || {}, isLoading };
}

export function useDropdownCategory(category: string) {
  const { options, isLoading } = useDropdownOptions();
  return { options: options[category] || [], isLoading };
}
