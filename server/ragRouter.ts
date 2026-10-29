import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import {
  createDocument,
  getUserDocuments,
  getDocumentById,
  deleteDocument,
  createChunk,
  getDocumentChunks,
  createEmbedding,
  getChunkEmbedding,
  createMessage,
  getChatHistory,
} from "./db";
import { chunkText, extractTextFromFile, generateEmbedding, findSimilarChunks } from "./documentProcessor";
import { invokeLLM } from "./_core/llm";
import { eq } from "drizzle-orm";
import { documents as documentsTable } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * RAG Router: handles document upload, processing, and chat
 */
export const ragRouter = router({
  /**
   * Upload a document
   * Accepts file buffer, extracts text, chunks it, generates embeddings
   */
  uploadDocument: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1),
        fileBase64: z.string(), // Base64 encoded file content
        mimeType: z.enum(["application/pdf", "text/plain", "text/markdown"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Decode base64 to buffer
        const fileBuffer = Buffer.from(input.fileBase64, "base64");

        if (fileBuffer.length === 0) {
          throw new Error("File is empty");
        }

        // Extract text from file
        const text = await extractTextFromFile(fileBuffer, input.mimeType);

        if (!text || text.trim().length === 0) {
          throw new Error("No text content extracted from file");
        }

        // Store file in S3
        const fileKey = `${ctx.user.id}/documents/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);

        // Create document record
        const docResult = await createDocument({
          userId: ctx.user.id,
          fileName: input.fileName,
          fileKey,
          fileUrl: url,
          fileSize: fileBuffer.length,
          mimeType: input.mimeType,
          totalChunks: 0,
        });

        // Get the inserted document ID
        const documentId = (docResult as any).insertId || docResult[0];

        if (!documentId) {
          throw new Error("Failed to create document record");
        }

        // Chunk the text
        const textChunks = chunkText(text);

        if (textChunks.length === 0) {
          throw new Error("No chunks created from document");
        }

        // Create chunks and generate embeddings
        for (let i = 0; i < textChunks.length; i++) {
          const chunkText = textChunks[i];

          // Create chunk record
          const chunkResult = await createChunk({
            documentId: documentId as number,
            chunkIndex: i,
            text: chunkText,
          });

          const chunkId = (chunkResult as any).insertId || chunkResult[0];

          if (!chunkId) {
            console.warn(`Failed to create chunk ${i} for document ${documentId}`);
            continue;
          }

          // Do not silently mark a partially indexed document as successful.
          const embedding = await generateEmbedding(chunkText);
          await createEmbedding({
            chunkId: chunkId as number,
            vector: embedding,
            model: "text-embedding-3-small",
          });
        }

        // Update document with correct chunk count
        const db = await getDb();
        if (db) {
          await db
            .update(documentsTable)
            .set({ totalChunks: textChunks.length })
            .where(eq(documentsTable.id, documentId as number));
        }

        return {
          success: true,
          documentId: documentId as number,
          chunksCreated: textChunks.length,
        };
      } catch (error) {
        console.error("Error uploading document:", error);
        const message = error instanceof Error ? error.message : "Failed to upload and process document";
        throw new Error(message);
      }
    }),

  /**
   * Get all documents for the current user
   */
  listDocuments: protectedProcedure.query(async ({ ctx }) => {
    return getUserDocuments(ctx.user.id);
  }),

  /**
   * Delete a document
   */
  deleteDocument: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const doc = await getDocumentById(input.documentId);
      if (!doc || doc.userId !== ctx.user.id) {
        throw new Error("Document not found or unauthorized");
      }

      await deleteDocument(input.documentId);
      return { success: true };
    }),

  /**
   * Get document details
   */
  getDocument: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const doc = await getDocumentById(input.documentId);
      if (!doc || doc.userId !== ctx.user.id) {
        return null;
      }
      return doc;
    }),

  /**
   * Query RAG: find relevant chunks and generate response
   */
  queryRAG: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        documentId: z.number().optional(),
        topK: z.number().max(10).default(5),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Generate embedding for the query
        const queryEmbedding = await generateEmbedding(input.query);

        // Get relevant documents
        let documents = await getUserDocuments(ctx.user.id);
        if (input.documentId) {
          const doc = await getDocumentById(input.documentId);
          if (!doc || doc.userId !== ctx.user.id) {
            throw new Error("Document not found");
          }
          documents = [doc];
        }

        if (documents.length === 0) {
          throw new Error("No documents available");
        }

        // Collect all chunks with embeddings
        const allChunksWithEmbeddings: Array<{
          chunkId: number;
          text: string;
          embedding: number[];
          documentId: number;
          documentName: string;
        }> = [];

        for (const doc of documents) {
          const chunks = await getDocumentChunks(doc.id);
          for (const chunk of chunks) {
            const embedding = await getChunkEmbedding(chunk.id);
            if (embedding && embedding.vector) {
              allChunksWithEmbeddings.push({
                chunkId: chunk.id,
                text: chunk.text,
                embedding: embedding.vector as number[],
                documentId: doc.id,
                documentName: doc.fileName,
              });
            }
          }
        }

        if (allChunksWithEmbeddings.length === 0) {
          throw new Error("No embeddings found for documents");
        }

        // Find most similar chunks
        const similarChunks = findSimilarChunks(
          queryEmbedding,
          allChunksWithEmbeddings.map((c) => ({
            chunkId: c.chunkId,
            embedding: c.embedding,
          })),
          input.topK,
          0.3 // Lower threshold to get more results
        );

        if (similarChunks.length === 0) {
          // Return a helpful message if no relevant chunks found
          const assistantResponse =
            "I couldn't find relevant information in your documents to answer this question. Try rephrasing your query or uploading documents related to your question.";

          await createMessage({
            userId: ctx.user.id,
            documentId: input.documentId || null,
            role: "user",
            content: input.query,
            sourceChunkIds: [],
          });

          await createMessage({
            userId: ctx.user.id,
            documentId: input.documentId || null,
            role: "assistant",
            content: assistantResponse,
            sourceChunkIds: [],
          });

          return {
            response: assistantResponse,
            sources: [],
            chunkCount: 0,
          };
        }

        // Get the actual chunk content
        const contextChunks = similarChunks
          .map((sim) => {
            const chunk = allChunksWithEmbeddings.find((c) => c.chunkId === sim.chunkId);
            return chunk
              ? {
                  chunkId: chunk.chunkId,
                  text: chunk.text,
                  documentName: chunk.documentName,
                  similarity: sim.similarity,
                }
              : null;
          })
          .filter(Boolean) as Array<{
            chunkId: number;
            text: string;
            documentName: string;
            similarity: number;
          }>;

        // Build context for LLM
        const contextText = contextChunks
          .map((c) => `[From ${c?.documentName}]\n${c?.text}`)
          .join("\n\n---\n\n");

        // Generate response using LLM
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that answers questions based on the provided documents. Always cite the document source when referencing information. Be concise and accurate.",
            },
            {
              role: "user",
              content: `Based on the following document excerpts, please answer this question: ${input.query}\n\nDocument excerpts:\n\n${contextText}`,
            },
          ],
        });

        const messageContent = response.choices[0]?.message.content;
        const assistantResponse =
          typeof messageContent === "string" && messageContent.trim()
            ? messageContent
            : "I was unable to generate a response. Please try again.";

        // Save messages to database
        await createMessage({
          userId: ctx.user.id,
          documentId: input.documentId || null,
          role: "user",
          content: input.query,
          sourceChunkIds: similarChunks.map((s) => s.chunkId),
        });

        await createMessage({
          userId: ctx.user.id,
          documentId: input.documentId || null,
          role: "assistant",
          content: assistantResponse,
          sourceChunkIds: similarChunks.map((s) => s.chunkId),
        });

        return {
          response: assistantResponse,
          sources: contextChunks as Array<{
            chunkId: number;
            text: string;
            documentName: string;
            similarity: number;
          }>,
          chunkCount: contextChunks.length,
        };
      } catch (error) {
        console.error("Error in RAG query:", error);
        const message = error instanceof Error ? error.message : "Failed to process query";
        throw new Error(message);
      }
    }),

  /**
   * Get chat history
   */
  getChatHistory: protectedProcedure
    .input(
      z.object({
        documentId: z.number().optional(),
        limit: z.number().max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      return getChatHistory(ctx.user.id, input.documentId, input.limit);
    }),
});
