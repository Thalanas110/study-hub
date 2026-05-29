import PDFDocument from "npm:pdfkit@0.17.2";
import { Buffer } from "node:buffer";

type ArchivePdfMessage = {
  authorName: string;
  content: string;
  createdAtLabel: string;
};

type RenderArchivePdfInput = {
  groupName: string;
  messageCount: number;
  messages: ArchivePdfMessage[];
  userPassword: string;
  windowLabel: string;
};

export async function renderArchivePdf(input: RenderArchivePdfInput) {
  const document = new PDFDocument({
    margin: 48,
    ownerPassword: input.userPassword,
    pdfVersion: "1.7ext3",
    permissions: {
      copying: false,
      modifying: false,
      printing: "lowResolution",
    },
    userPassword: input.userPassword,
  });

  const chunks: Uint8Array[] = [];

  return await new Promise<Uint8Array>((resolve, reject) => {
    document.on("data", (chunk) => chunks.push(chunk instanceof Uint8Array ? chunk : Buffer.from(chunk)));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    document.fontSize(20).fillColor("#111827").text(input.groupName);
    document.moveDown(0.35);
    document.fontSize(11).fillColor("#4b5563").text(input.windowLabel);
    document.text(`${input.messageCount} messages archived`);
    document.moveDown();

    input.messages.forEach((message) => {
      document.fontSize(10).fillColor("#6b7280").text(`${message.createdAtLabel}  ${message.authorName}`);
      document.moveDown(0.15);
      document.fontSize(11).fillColor("#111827").text(message.content, {
        width: document.page.width - document.page.margins.left - document.page.margins.right,
      });
      document.moveDown();
    });

    document.end();
  });
}
