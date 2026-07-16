// Voice dictation via the Web Speech API (needs HTTPS or localhost, and a
// browser with SpeechRecognition — Chrome/Edge on Android tablets work well).

export function voiceSupported() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Start dictation. Returns a controller with .stop(). Callbacks:
 *   onResult(transcript, isFinal) — called as text arrives
 *   onEnd() — recognition finished (naturally or via stop)
 *   onError(message)
 */
export function startDictation({ lang = "da-DK", onResult, onEnd, onError }) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    onError?.("Voice input is not supported in this browser.");
    return { stop() {} };
  }

  const rec = new Recognition();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;

  let finalText = "";
  rec.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const chunk = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += chunk + " ";
      else interim += chunk;
    }
    onResult?.((finalText + interim).trim(), interim === "");
  };
  rec.onerror = (event) => {
    if (event.error === "no-speech") return; // benign
    onError?.(
      event.error === "not-allowed"
        ? "Microphone access was denied. Allow it in the browser settings (HTTPS required)."
        : `Voice input error: ${event.error}`,
    );
  };
  rec.onend = () => onEnd?.();

  try {
    rec.start();
  } catch (err) {
    onError?.(String(err.message || err));
  }
  return { stop: () => rec.stop() };
}
