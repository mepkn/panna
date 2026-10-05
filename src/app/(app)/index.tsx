import * as Clipboard from "expo-clipboard";
import { router, Stack } from "expo-router";
import { Check, Copy, Settings, Trash2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MAX_TEXT_BYTES } from "@convex/lib/limits";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpConfirmDialog } from "@/components/cmp/cmp-confirm-dialog";
import { CmpEditor } from "@/components/cmp/cmp-editor";
import { CmpKeyboardPadding } from "@/components/cmp/cmp-keyboard-padding";
import { CmpText } from "@/components/cmp/cmp-text";
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

export default function PadScreen() {
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
    <SafeAreaView edges={["bottom"]} className="bg-background flex-1">
      <Stack.Screen
        options={{
          headerRight: () => (
            <View className="flex-row items-center gap-1">
              <CmpButton
                variant="ghost"
                size="icon"
                icon={copied ? Check : Copy}
                label={copied ? s.copied : s.copyAll}
                disabled={!pad.text}
                onPress={async () => {
                  await Clipboard.setStringAsync(pad.text);
                  setCopied(true);
                }}
              />
              <CmpButton
                variant="ghost"
                size="icon"
                icon={Trash2}
                label={s.clear}
                disabled={!pad.text}
                onPress={() => setConfirmClear(true)}
              />
              <CmpButton
                variant="ghost"
                size="icon"
                icon={Settings}
                label={s.settings}
                onPress={() => router.push("/settings")}
              />
            </View>
          ),
        }}
      />
      {/* The editor and status line sit above the keyboard. */}
      <CmpKeyboardPadding>
        <CmpEditor
          value={pad.text}
          onChangeText={pad.change}
          editable={pad.loaded}
          placeholder={pad.loaded ? s.placeholder : s.loading}
          autoFocus={Platform.OS === "web"}
        />
        <View className="border-border flex-row items-center gap-3 border-t px-4 py-1.5">
          <CmpText
            variant="muted"
            className={cn("text-xs", pad.status === "offline" && "text-destructive")}>
            {STATUS_LABEL[pad.status]}
          </CmpText>
          {(pad.error || pad.tooLong) && (
            <CmpText className="text-destructive flex-1 text-xs" numberOfLines={1}>
              {pad.tooLong ? s.tooLong : pad.error}
            </CmpText>
          )}
          {nearLimit && (
            <CmpText
              variant="muted"
              className={cn("ml-auto text-xs", pad.tooLong && "text-destructive")}>
              {s.size(kb(pad.bytes), kb(MAX_TEXT_BYTES))}
            </CmpText>
          )}
        </View>
      </CmpKeyboardPadding>
      <CmpConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={s.clearTitle}
        description={s.clearDescription}
        confirmLabel={s.clear}
        cancelLabel={strings.cancel}
        destructive
        onConfirm={pad.clear}
      />
    </SafeAreaView>
  );
}
