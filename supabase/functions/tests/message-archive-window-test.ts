import { assertEquals } from "jsr:@std/assert@1";
import {
  buildArchiveStoragePath,
  formatArchiveMessageTimeLabel,
  formatArchiveWindowLabel as formatBackendWindowLabel,
  getArchiveExpiry,
  getArchiveWindow,
} from "../_shared/message-archive-window.ts";
import {
  formatArchiveExpiryLabel,
  formatArchiveWindowLabel,
  isArchiveVisible,
} from "../../../src/lib/message-archives.ts";

Deno.test("aligns a 06:00 GMT+8 run to the midnight-to-06:00 window", () => {
  const { windowStart, windowEnd } = getArchiveWindow(new Date("2026-05-28T22:00:00.000Z"));

  assertEquals(windowStart.toISOString(), "2026-05-28T16:00:00.000Z");
  assertEquals(windowEnd.toISOString(), "2026-05-28T22:00:00.000Z");
});

Deno.test("builds a deterministic storage path in GMT+8", () => {
  const path = buildArchiveStoragePath(
    "group-123",
    new Date("2026-05-28T16:00:00.000Z"),
    new Date("2026-05-28T22:00:00.000Z"),
  );

  assertEquals(
    path,
    "group-123/2026/05/29/2026-05-29T00-00-00+08-00_2026-05-29T06-00-00+08-00.pdf",
  );
});

Deno.test("adds 12 hours to compute archive expiry", () => {
  const expiresAt = getArchiveExpiry(new Date("2026-05-29T00:00:00.000Z"));
  assertEquals(expiresAt.toISOString(), "2026-05-29T12:00:00.000Z");
});

Deno.test("formats the same GMT+8 label in the backend and UI helpers", () => {
  const windowStart = "2026-05-28T16:00:00.000Z";
  const windowEnd = "2026-05-28T22:00:00.000Z";

  assertEquals(formatBackendWindowLabel(windowStart, windowEnd), "May 29, 2026 00:00-06:00 GMT+8");
  assertEquals(formatArchiveWindowLabel(windowStart, windowEnd), "May 29, 2026 00:00-06:00 GMT+8");
});

Deno.test("formats per-message archive times in GMT+8", () => {
  assertEquals(formatArchiveMessageTimeLabel("2026-05-28T16:05:00.000Z"), "00:05");
});

Deno.test("hides expired archives and formats expiry labels in GMT+8", () => {
  assertEquals(isArchiveVisible("2026-05-29T10:00:01.000Z", new Date("2026-05-29T10:00:00.000Z")), true);
  assertEquals(isArchiveVisible("2026-05-29T09:59:59.000Z", new Date("2026-05-29T10:00:00.000Z")), false);
  assertEquals(
    formatArchiveExpiryLabel("2026-05-29T12:00:00.000Z"),
    "Expires May 29, 2026 20:00 GMT+8",
  );
});
