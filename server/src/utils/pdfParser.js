import { PDFParse } from "pdf-parse";

export async function extractTextFromBuffer(buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const [textResult, infoResult] = await Promise.all([
      parser.getText(),
      parser.getInfo(),
    ]);

    return {
      text: textResult.text,
      pageCount: infoResult.total,
      info: infoResult.info,
    };
  } finally {
    await parser.destroy();
  }
}
