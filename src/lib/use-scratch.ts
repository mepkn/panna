import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import { MAX_TEXT_BYTES, textBytes } from "@convex/lib/limits";
import { errorMessage } from "./errors";

export type SyncStatus = "loading" | "saving" | "saved" | "offline";

const SAVE_DELAY_MS = 500;

// One plain-text pad per user, synced last-write-wins.
// Local edits are saved SAVE_DELAY_MS after typing stops. A remote change is
// applied only while there are no unsaved or in-flight local edits, so the
// cursor never jumps while typing.
export function useScratch() {
  const remote = useQuery(api.scratch.get);
  const saveMutation = useMutation(api.scratch.save);
  const connection = useConvexConnectionState();

  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [tooLong, setTooLong] = useState(false);
  // Re-renders the controlled input when a change is refused, so the native
  // view snaps back to the last accepted text.
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  const latest = useRef("");
  const version = useRef(0);
  const dirty = useRef(false);
  const inflight = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (remote === undefined || pending) return;
    const next = remote ?? { text: "", version: 0 };
    // Our own save may already be newer than a subscription result in flight.
    if (loaded && next.version < version.current) return;
    version.current = next.version;
    latest.current = next.text;
    setText(next.text);
    setLoaded(true);
  }, [remote, pending, loaded]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    const sent = latest.current;
    inflight.current++;
    try {
      version.current = await saveMutation({ text: sent, baseVersion: version.current });
      setError(undefined);
    } catch (e) {
      // Keep the edit unsaved; the next keystroke retries.
      dirty.current = true;
      setError(errorMessage(e));
    } finally {
      inflight.current--;
      if (!dirty.current && inflight.current === 0) setPending(false);
    }
  }, [saveMutation]);

  const change = useCallback(
    (next: string) => {
      const bytes = textBytes(next);
      if (bytes > MAX_TEXT_BYTES && bytes > textBytes(latest.current)) {
        setTooLong(true);
        forceRender();
        return;
      }
      setTooLong(false);
      latest.current = next;
      setText(next);
      dirty.current = true;
      setPending(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  const clear = useCallback(() => {
    change("");
    void flush();
  }, [change, flush]);

  // Don't drop the last few keystrokes when leaving the screen.
  useEffect(() => () => void flush(), [flush]);

  const status: SyncStatus = !connection.isWebSocketConnected
    ? "offline"
    : !loaded
      ? "loading"
      : pending
        ? "saving"
        : "saved";

  return {
    text,
    loaded,
    status,
    error,
    tooLong,
    bytes: textBytes(text),
    change,
    clear,
  };
}
