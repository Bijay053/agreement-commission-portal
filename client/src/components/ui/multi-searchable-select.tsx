import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSearchableSelectProps {
  values: string[];
  onValuesChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  "data-testid"?: string;
}

export function MultiSearchableSelect({
  values = [],
  onValuesChange,
  options,
  placeholder = "All",
  searchPlaceholder = "Search...",
  className,
  disabled = false,
  "data-testid": dataTestId,
}: MultiSearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerWidth, setTriggerWidth] = useState<number | undefined>();

  useEffect(() => {
    if (open && triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

  const toggleValue = (val: string) => {
    if (values.includes(val)) {
      onValuesChange(values.filter(v => v !== val));
    } else {
      onValuesChange([...values, val]);
    }
  };

  const selectAll = () => onValuesChange(options.map(o => o.value));
  const deselectAll = () => onValuesChange([]);
  const allSelected = options.length > 0 && values.length === options.length;

  const displayText = () => {
    if (values.length === 0) return placeholder;
    const selectedLabels = values.map(v => options.find(o => o.value === v)?.label || v);
    if (selectedLabels.length === 1) return selectedLabels[0];
    if (selectedLabels.length === 2) return selectedLabels.join(", ");
    return `${selectedLabels[0]}, ${selectedLabels[1]} +${selectedLabels.length - 2}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !className?.includes("h-") && "h-9",
            values.length === 0 && "text-muted-foreground",
            className
          )}
          data-testid={dataTestId}
        >
          <span className="truncate text-left">
            {displayText()}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {values.length > 0 && (
              <X
                className="h-3.5 w-3.5 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  deselectAll();
                }}
              />
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: triggerWidth ? `${Math.max(triggerWidth, 200)}px` : undefined }}
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="!max-h-[240px] !overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full"
            onWheel={(e) => { e.currentTarget.scrollTop += e.deltaY; }}
          >
            <CommandEmpty>No results found</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => allSelected ? deselectAll() : selectAll()}
                className="cursor-pointer"
              >
                <div className={cn(
                  "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary shrink-0",
                  allSelected ? "bg-primary text-primary-foreground" : "opacity-50"
                )}>
                  {allSelected && <Check className="h-3 w-3" />}
                </div>
                <span className="font-medium">{allSelected ? "Deselect All" : "Select All"}</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {options.map((option) => {
                const isSelected = values.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => toggleValue(option.value)}
                    className="cursor-pointer"
                  >
                    <div className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary shrink-0",
                      isSelected ? "bg-primary text-primary-foreground" : "opacity-50"
                    )}>
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
