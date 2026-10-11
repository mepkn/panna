import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon, Trash2Icon } from "lucide-react";
import { MAX_TEXT_BYTES } from "@convex/lib/limits";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { strings } from "@/lib/strings";
import { usePad, type SyncStatus } from "@/lib/use-pad";
import { cn } from "@/lib/utils";

const s = strings.pad;

// The size counter appears once the text passes this share of the limit.
const COUNTER_FROM = 0.8;

const STATUS_LABEL: Record<SyncStatus, string> = {
  loading: s.loading,
  saving: s.saving,
  saved: s.saved,
  offline: s.offline,
};

const kb = (bytes: number) => (bytes / 1024).toFixed(1);

/** The single pad: a full-height text area that saves as you type. */
export function PadPage() {
  const pad = usePad();
  const [confirmClear, setConfirmClear] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  const nearLimit = pad.bytes >= MAX_TEXT_BYTES * COUNTER_FROM;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
            pad.status === "offline" && "text-destructive",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              pad.status === "saved" && "bg-emerald-500",
              pad.status === "saving" && "animate-pulse bg-amber-500",
              pad.status === "loading" && "animate-pulse bg-muted-foreground",
              pad.status === "offline" && "bg-destructive",
            )}
          />
          {STATUS_LABEL[pad.status]}
        </span>
        {(pad.error || pad.tooLong) && (
          <span role="alert" className="truncate text-xs text-destructive">
            {pad.tooLong ? s.tooLong : pad.error}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {nearLimit && (
            <span className={cn("mr-2 text-xs text-muted-foreground tabular-nums", pad.tooLong && "text-destructive")}>
              {s.size(kb(pad.bytes), kb(MAX_TEXT_BYTES))}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={!pad.text}
            onClick={async () => {
              await navigator.clipboard.writeText(pad.text);
              setCopied(true);
            }}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? s.copied : s.copyAll}
          </Button>
          <Button variant="ghost" size="sm" disabled={!pad.text} onClick={() => setConfirmClear(true)}>
            <Trash2Icon /> {s.clear}
          </Button>
        </div>
      </div>
      <textarea
        aria-label={strings.appName}
        value={pad.text}
        onChange={(e) => pad.change(e.target.value)}
        disabled={!pad.loaded}
        placeholder={pad.loaded ? s.placeholder : s.loading}
        autoFocus
        spellCheck={false}
        className="min-h-0 flex-1 resize-none bg-transparent px-5 py-4 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-60"
      />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={s.clearTitle}
        description={s.clearDescription}
        confirmLabel={s.clear}
        onConfirm={pad.clear}
      />
    </div>
  );
}
