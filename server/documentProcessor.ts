// Document processing utilities for RAG pipeline

/**
 * Extract text from a PDF file
 * Uses the built-in PDF parsing capability
 */
export async function extractTextFromPDF(fileBuffer: Buffer): Promise<string> {
  try {
    // For PDF files, we'll use a simple approach:
    // Convert PDF to text using the LLM's vision capability or external service
    // For now, we'll use a placeholder that can be enhanced
    
    // In production, you might use a library like pdf-parse or pdfjs-dist
    // For this implementation, we'll assume text extraction happens server-side
    const text = await extractPDFText(fileBuffer);
    return text;
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    throw new Error("Failed to extract text from PDF");
  }
}

/**
 * Simple PDF text extraction (placeholder for production use)
 * In production, integrate with pdf-parse or similar library
 */
async function extractPDFText(buffer: Buffer): Promise<string> {
  // This is a placeholder. In production, use:
  // const pdf = await import('pdf-parse');
  // const data = await pdf(buffer);
  // return data.text;
  
  // For now, return a basic extraction
  return buffer.toString("utf-8", 0, Math.min(buffer.length, 10000));
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
 * Split text into chunks with overlap
 * Uses semantic boundaries when possible
 */
export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  
  // Split by paragraphs first for better semantic boundaries
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = "";
  
  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  // If we have very large paragraphs, split them by sentences
  const finalChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length > chunkSize) {
      const sentences = chunk.match(/[^.!?]+[.!?]+/g) || [chunk];
      let subChunk = "";
      
      for (const sentence of sentences) {
        if ((subChunk + sentence).length > chunkSize) {
          if (subChunk) {
            finalChunks.push(subChunk.trim());
          }
          subChunk = sentence;
        } else {
          subChunk += sentence;
        }
      }
      
      if (subChunk) {
        finalChunks.push(subChunk.trim());
      }
    } else {
      finalChunks.push(chunk);
    }
  }
  
  return finalChunks.filter((c) => c.length > 50); // Filter out very small chunks
}

/**
 * Generate embedding for a text chunk using the built-in LLM API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Use the built-in embedding model
    const response = await fetch(`${process.env.BUILT_IN_FORGE_API_URL}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract the embedding vector from the response
    if (data.data && data.data[0] && data.data[0].embedding) {
      return data.data[0].embedding;
    }
    
    throw new Error("Invalid embedding response format");
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Failed to generate embedding for chunk");
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
