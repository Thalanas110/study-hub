import { assert, assertEquals } from "jsr:@std/assert@1";
import { renderArchivePdf } from "../_shared/message-archive-pdf.ts";

Deno.test("renderArchivePdf returns a non-empty PDF document", async () => {
  const pdf = await renderArchivePdf({
    groupName: "Algorithms",
    messageCount: 2,
    messages: [
      { authorName: "Ada", content: "Need help with Dijkstra.", createdAtLabel: "00:15" },
      { authorName: "Grace", content: "Let's review the heap invariant.", createdAtLabel: "00:17" },
    ],
    userPassword: "20May2026",
    windowLabel: "May 29, 2026 00:00-06:00 GMT+8",
  });

  assert(pdf.byteLength > 512);
  assertEquals(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
});
