const API_BASE = (import.meta.env?.VITE_API_BASE || "/api").replace(/\/$/, "");

async function errorFor(response) {
  const data = await response.json().catch(() => ({}));
  return new Error(
    data.error || `Không thể kết nối dịch vụ (HTTP ${response.status}).`,
  );
}

export async function checkHealth(signal) {
  const response = await fetch(`${API_BASE}/health`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
  });
  if (!response.ok || (await response.json()).status !== "ok")
    throw new Error("Unavailable");
}

export async function askChat(payload, { signal, onEvent = () => {} } = {}) {
  const timedSignal = AbortSignal.any([
    signal || new AbortController().signal,
    AbortSignal.timeout(180000),
  ]);
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(payload),
    signal: timedSignal,
  };
  let hasToken = false;
  try {
    const response = await fetch(`${API_BASE}/chat/stream`, options);
    if (!response.ok) throw await errorFor(response);
    if (!response.headers.get("content-type")?.includes("text/event-stream"))
      throw new Error("Streaming chưa được hỗ trợ.");
    let done;
    await readEvents(response.body, (event, data) => {
      if (event === "error")
        throw new Error(data.error || "Luồng trả lời bị gián đoạn.");
      if (event === "token") hasToken = true;
      if (event === "done") done = data;
      onEvent(event, data);
    });
    if (!done)
      throw new Error("Kết nối bị ngắt trước khi câu trả lời hoàn tất.");
    return done;
  } catch (error) {
    if (timedSignal.aborted || hasToken) throw error;
    onEvent("reset", {});
    const response = await fetch(`${API_BASE}/chat`, options);
    if (!response.ok) throw await errorFor(response);
    return response.json();
  }
}

// SSE frames can cross arbitrary UTF-8/network boundaries. Never parse per fetch chunk.
export async function readEvents(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const drain = () => {
    let match;
    while ((match = /\r?\n\r?\n/.exec(buffer))) {
      const frame = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      let event = "message";
      const data = [];
      for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:"))
          data.push(line.slice(5).replace(/^ /, ""));
      }
      if (data.length) onEvent(event, JSON.parse(data.join("\n")));
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        drain();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      drain();
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
