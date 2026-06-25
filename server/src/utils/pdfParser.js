import { PDFParse } from "pdf-parse";

export async function extractTextFromBuffer(buffer) {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();

    return {
      text: textResult.text,
      pageCount: infoResult.total,
      info: infoResult.info,
    };
  } finally {
    await parser.destroy();
  }
}
