"use client";

import { useEffect, useRef, useState } from "react";

export function VoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setSupported(Boolean(navigator.mediaDevices && typeof MediaRecorder !== "undefined")),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);

  async function toggle() {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    if (!supported) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks.current = [];
    const next = new MediaRecorder(stream);
    next.ondataavailable = (event) => chunks.current.push(event.data);
    next.onstop = () => {
      const blob = new Blob(chunks.current, { type: next.mimeType || "audio/webm" });
      const file = new File([blob], "voice-note.webm", { type: blob.type });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      if (input.current) input.current.files = transfer.files;
      stream.getTracks().forEach((track) => track.stop());
      setReady(true);
    };
    recorder.current = next;
    next.start();
    setRecording(true);
  }

  return (
    <div>
      <input ref={input} name="files" type="file" hidden accept="audio/*" />
      <button className="button secondary small" type="button" onClick={toggle} disabled={!supported}>
        {recording ? "■ Stop recording" : ready ? "✓ Voice note ready" : "🎙 Record a voice note"}
      </button>
      {!supported && <small className="muted"> Voice recording isn’t available in this browser.</small>}
    </div>
  );
}
