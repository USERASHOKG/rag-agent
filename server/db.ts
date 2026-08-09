import { eq, inArray, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, documents, chunks, embeddings, messages, InsertDocument, InsertChunk, InsertEmbedding, InsertMessage } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get all documents for a user
 */
export async function getUserDocuments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documents).where(eq(documents.userId, userId)).orderBy((t) => t.createdAt);
}

/**
 * Get a single document by ID
 */
export async function getDocumentById(documentId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  return result[0];
}

/**
 * Create a new document
 */
export async function createDocument(doc: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(documents).values(doc);
  return result;
}

/**
 * Delete a document and all its chunks/embeddings
 */
export async function deleteDocument(documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete embeddings first
  await db.delete(embeddings).where(inArray(embeddings.chunkId, db.select({ id: chunks.id }).from(chunks).where(eq(chunks.documentId, documentId))));
  // Delete chunks
  await db.delete(chunks).where(eq(chunks.documentId, documentId));
  // Delete messages
  await db.delete(messages).where(eq(messages.documentId, documentId));
  // Delete document
  await db.delete(documents).where(eq(documents.id, documentId));
}

/**
 * Create a chunk for a document
 */
export async function createChunk(chunk: InsertChunk) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(chunks).values(chunk);
  return result;
}

/**
 * Get all chunks for a document
 */
export async function getDocumentChunks(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chunks).where(eq(chunks.documentId, documentId)).orderBy((t) => t.chunkIndex);
}

/**
 * Create an embedding for a chunk
 */
export async function createEmbedding(embedding: InsertEmbedding) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(embeddings).values(embedding);
  return result;
}

/**
 * Get embedding for a chunk
 */
export async function getChunkEmbedding(chunkId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(embeddings).where(eq(embeddings.chunkId, chunkId)).limit(1);
  return result[0];
}

/**
 * Save a message
 */
export async function createMessage(message: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(messages).values(message);
  return result;
}

/**
 * Get chat history for a user/document
 */
export async function getChatHistory(userId: number, documentId?: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  if (documentId) {
    return db.select().from(messages).where(
      and(eq(messages.userId, userId), eq(messages.documentId, documentId))
    ).orderBy((t) => t.createdAt).limit(limit);
  }
  
  return db.select().from(messages).where(eq(messages.userId, userId)).orderBy((t) => t.createdAt).limit(limit);
}
