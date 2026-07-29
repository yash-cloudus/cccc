"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice dictation for form fields, via the browser's built-in Web Speech API.
 *
 * Chosen over a server-side transcription service because it needs no API key,
 * no per-minute cost and no new dependency — the same trade the Gujarati
 * transliteration already makes. Chrome / Edge / Safari support it (Chrome
 * streams the audio to Google, which is where `gu-IN` recognition happens);
 * Firefox does not, so `supported` is false there and callers hide the button
 * rather than showing one that cannot work.
 */

/** Minimal shape of the vendor-prefixed API — lib.dom does not declare it. */
type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = { 0: SpeechRecognitionAlternative; isFinal: boolean };
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResult };
};
type SpeechRecognitionErrorEventLike = { error: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechLang = "gu-IN" | "en-IN";

export function useSpeechInput({
  lang,
  onText,
}: {
  lang: SpeechLang;
  /**
   * Called with the transcript so far. Fires repeatedly while the user speaks
   * (interim results), so the caller must overwrite rather than append — see
   * `baseRef` handling in the mic button.
   */
  onText: (transcript: string, isFinal: boolean) => void;
}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  // Kept in a ref so restarting never re-creates the recognizer mid-utterance.
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  // Detected after mount — `window` does not exist during SSR.
  useEffect(() => setSupported(getCtor() !== null), []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;

    // A second tap while listening means "stop", not "start again".
    if (recRef.current) {
      recRef.current.abort();
      recRef.current = null;
      setListening(false);
      return;
    }

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let text = "";
      let isFinal = false;
      for (let i = 0; i < e.results.length; i += 1) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) isFinal = true;
      }
      onTextRef.current(text, isFinal);
    };

    rec.onerror = (e) => {
      // "aborted" is our own stop(); "no-speech" is a silent timeout — neither
      // is worth shouting about.
      if (e.error !== "aborted" && e.error !== "no-speech") setError(e.error);
      setListening(false);
    };

    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };

    try {
      rec.start();
      recRef.current = rec;
      setError(null);
      setListening(true);
    } catch {
      // start() throws if a recognizer is already running in this tab.
      recRef.current = null;
      setListening(false);
    }
  }, [lang]);

  useEffect(() => () => recRef.current?.abort(), []);

  return { listening, supported, error, start, stop };
}
