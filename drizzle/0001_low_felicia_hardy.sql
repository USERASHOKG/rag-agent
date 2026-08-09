CREATE TABLE `chunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`chunkIndex` int NOT NULL,
	`text` text NOT NULL,
	`embeddingId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(255) NOT NULL,
	`fileUrl` varchar(512) NOT NULL,
	`fileSize` int NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`totalChunks` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `embeddings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chunkId` int NOT NULL,
	`vector` json NOT NULL,
	`model` varchar(100) NOT NULL DEFAULT 'text-embedding-3-small',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `embeddings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`documentId` int,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`sourceChunkIds` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `chunks_documentId_idx` ON `chunks` (`documentId`);--> statement-breakpoint
CREATE INDEX `documents_userId_idx` ON `documents` (`userId`);--> statement-breakpoint
CREATE INDEX `embeddings_chunkId_idx` ON `embeddings` (`chunkId`);--> statement-breakpoint
CREATE INDEX `messages_userId_idx` ON `messages` (`userId`);--> statement-breakpoint
CREATE INDEX `messages_documentId_idx` ON `messages` (`documentId`);