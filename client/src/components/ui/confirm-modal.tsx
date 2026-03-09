import { useState, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, CheckCircle2, Info, HelpCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ModalVariant = "danger" | "warning" | "success" | "info" | "confirm";

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: ModalVariant;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  "data-testid"?: string;
}

const variantConfig: Record<ModalVariant, {
  icon: typeof AlertTriangle;
  iconBg: string;
  iconColor: string;
  buttonClass: string;
  defaultConfirmText: string;
}> = {
  danger: {
    icon: Trash2,
    iconBg: "bg-red-100 dark:bg-red-950/50",
    iconColor: "text-red-600 dark:text-red-400",
    buttonClass: "bg-red-600 hover:bg-red-700 text-white focus-visible:ring-red-600",
    defaultConfirmText: "Delete",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-amber-100 dark:bg-amber-950/50",
    iconColor: "text-amber-600 dark:text-amber-400",
    buttonClass: "bg-amber-600 hover:bg-amber-700 text-white focus-visible:ring-amber-600",
    defaultConfirmText: "Continue",
  },
  success: {
    icon: CheckCircle2,
    iconBg: "bg-green-100 dark:bg-green-950/50",
    iconColor: "text-green-600 dark:text-green-400",
    buttonClass: "bg-green-600 hover:bg-green-700 text-white focus-visible:ring-green-600",
    defaultConfirmText: "OK",
  },
  info: {
    icon: Info,
    iconBg: "bg-blue-100 dark:bg-blue-950/50",
    iconColor: "text-blue-600 dark:text-blue-400",
    buttonClass: "bg-blue-600 hover:bg-blue-700 text-white focus-visible:ring-blue-600",
    defaultConfirmText: "OK",
  },
  confirm: {
    icon: HelpCircle,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    buttonClass: "",
    defaultConfirmText: "Confirm",
  },
};

export function ConfirmModal({
  open,
  onOpenChange,
  variant = "confirm",
  title,
  description,
  confirmText,
  cancelText = "Cancel",
  onConfirm,
  "data-testid": dataTestId,
}: ConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [onConfirm, onOpenChange]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="max-w-[420px] p-0 gap-0 overflow-hidden"
        data-testid={dataTestId}
      >
        <div className="p-6 pb-4">
          <AlertDialogHeader className="space-y-4">
            <div className="flex items-start gap-4">
              <div className={cn(
                "flex items-center justify-center w-11 h-11 rounded-full shrink-0",
                config.iconBg
              )}>
                <Icon className={cn("w-5 h-5", config.iconColor)} />
              </div>
              <div className="space-y-1.5 pt-0.5">
                <AlertDialogTitle className="text-base font-semibold leading-tight">
                  {title}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter className="bg-muted/40 border-t px-6 py-3.5 flex-row justify-end gap-2.5">
          <AlertDialogCancel
            disabled={loading}
            className="mt-0 h-9 px-4 text-sm"
            data-testid={dataTestId ? `${dataTestId}-cancel` : undefined}
          >
            {cancelText}
          </AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className={cn("h-9 px-4 text-sm", config.buttonClass)}
            data-testid={dataTestId ? `${dataTestId}-confirm` : undefined}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {confirmText || config.defaultConfirmText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
