// Document processing utilities for RAG pipeline

/**
 * Extract searchable text from a PDF.
 * pdf-parse v2 supports in-memory buffers and must be destroyed after parsing.
 */
export async function extractTextFromPDF(fileBuffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: fileBuffer });

  try {
    const result = await parser.getText();
    const text = result.text?.trim() ?? "";

    if (!text) {
      throw new Error(
        "No selectable text found in this PDF. If it is a scanned document, OCR is required."
      );
    }

    return text;
  } catch (error) {
    if (error instanceof Error && error.message.includes("No selectable text")) {
      throw error;
    }
    console.error("Error extracting PDF text:", error);
    throw new Error("Could not read this PDF. Check that it is a valid, unencrypted PDF.");
  } finally {
    await parser.destroy();
  }
}

/**
 * Extract text from plain text file
 */
export async function extractTextFromFile(fileBuffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    return extractTextFromPDF(fileBuffer);
  } else if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return fileBuffer.toString("utf-8");
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

/**
 * Split text into bounded chunks with real overlap.
 * Prefer paragraph boundaries, but fall back to a character window for long paragraphs.
 */
export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  if (!text.trim()) return [];
  if (chunkSize < 1 || overlap < 0 || overlap >= chunkSize) {
    throw new Error("chunkSize must be positive and overlap must be between 0 and chunkSize - 1");
  }

  const normalized = text.replace(/\r\n/g, "\n").trim();
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);

    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf("\n", end);
      // Use a paragraph boundary only when it does not make the chunk too small.
      if (boundary > start + Math.floor(chunkSize * 0.6)) {
        end = boundary;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;

    // Keep the next chunk overlapping the previous one, while guaranteeing progress.
    start = Math.max(start + 1, end - overlap);
  }

  return chunks;
}

/**
 * Generate embedding for a text chunk using the built-in LLM API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const baseUrl = process.env.BUILT_IN_FORGE_API_URL?.replace(/\/$/, "");
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Embedding service is not configured. Set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY.");
  }

  try {
    const response = await fetch(`${baseUrl}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: Array<{ embedding?: unknown }>;
    };
    const embedding = data.data?.[0]?.embedding;

    if (
      !Array.isArray(embedding) ||
      embedding.length === 0 ||
      !embedding.every((value) => typeof value === "number" && Number.isFinite(value))
    ) {
      throw new Error("Embedding API returned an invalid vector");
    }

    return embedding as number[];
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error instanceof Error
      ? error
      : new Error("Failed to generate embedding for chunk");
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Find the most similar chunks to a query
 */
export function findSimilarChunks(
  queryEmbedding: number[],
  chunkEmbeddings: Array<{ chunkId: number; embedding: number[] }>,
  topK = 5,
  threshold = 0.5
): Array<{ chunkId: number; similarity: number }> {
  const similarities = chunkEmbeddings.map((item) => ({
    chunkId: item.chunkId,
    similarity: cosineSimilarity(queryEmbedding, item.embedding),
  }));

  return similarities
    .filter((item) => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
