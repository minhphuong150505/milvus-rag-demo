import { test } from "node:test";
import assert from "node:assert/strict";
import { readEvents } from "../src/api/chatApi.js";

function stream(text, width = 1) {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset === bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + width));
      offset = Math.min(bytes.length, offset + width);
    },
  });
}
test("parses Vietnamese tokens across single-byte UTF-8 and CRLF boundaries", async () => {
  const events = [];
  await readEvents(
    stream(
      ': heartbeat\r\n\r\nevent: token\r\ndata: {"token":"Tiếng Việt [1]"}\r\n\r\nevent: done\ndata: {"grounded":true}\n\n',
    ),
    (name, data) => events.push([name, data]),
  );
  assert.deepEqual(events, [
    ["token", { token: "Tiếng Việt [1]" }],
    ["done", { grounded: true }],
  ]);
});
test("supports several frames in one read and multiline data", async () => {
  const events = [];
  await readEvents(
    stream(
      'event: sources\ndata: {"sources":\ndata: []}\n\nevent: token\ndata: {"token":"a"}\n\n',
      200,
    ),
    (name, data) => events.push([name, data]),
  );
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], ["sources", { sources: [] }]);
});
test("rejects malformed data and cancels reader on failure", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode("event: token\ndata: invalid\n\n"));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readEvents(body, () => {}),
    SyntaxError,
  );
  assert.equal(cancelled, true);
});
