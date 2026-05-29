import { useState, useCallback, useRef } from "react";

export type ConfirmOptions = {
  title: string;
  description: string;
  actionLabel?: string;
  variant?: "destructive" | "default";
};

export type ConfirmDialogState = {
  open: boolean;
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
};

export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: "",
    description: "",
    actionLabel: "Confirm",
    variant: "destructive",
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirmAsync = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions({ actionLabel: "Confirm", variant: "destructive", ...opts });
    setOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const onConfirm = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const onCancel = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  const confirmDialogProps: ConfirmDialogState = {
    open,
    options,
    onConfirm,
    onCancel,
  };

  return { confirmAsync, confirmDialogProps };
}
