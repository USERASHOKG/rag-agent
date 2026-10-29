# RAG Agent

Ask questions about your own documents. The app indexes document text, searches for relevant passages, and uses an AI model to answer with source references.

> **Current limitation:** PDF text extraction is not enabled in this branch. Upload `.txt` or `.md` files. PDF uploads will return a clear error until a PDF parser is added.

## What you need

- Node.js **22 or newer**
- [pnpm](https://pnpm.io/installation)
- A MySQL-compatible database
- Valid credentials for the configured Manus/Forge AI API, OAuth, and S3-compatible file storage

You need working credentials and access to these services; installing the code alone is not enough.

## Run locally

### 1. Download the project

```bash
git clone https://github.com/USERASHOKG/rag-agent.git
cd rag-agent
```

To test the current reliability changes, switch to the feature branch:

```bash
git switch feature/rag-reliability
```

If you cloned the repository without that branch locally, run `git fetch origin` first.

### 2. Install dependencies

```bash
pnpm install
```

If `pnpm` is not found, install/enable it with Corepack:

```bash
corepack enable
corepack prepare pnpm@10.4.1 --activate
```

Close and reopen your terminal if the command still is not found.

### 3. Configure environment variables

Create a file named `.env.local` in the project root. This repository does not currently include an `.env.example`, so add the values supplied by your project/service administrator.

Variables used by this app include:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Secret used to sign session tokens; use a long random value |
| `VITE_APP_ID` | OAuth/application ID |
| `OAUTH_SERVER_URL` | OAuth service base URL |
| `BUILT_IN_FORGE_API_URL` | AI/embedding API base URL |
| `BUILT_IN_FORGE_API_KEY` | Secret API key for the AI service |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend API base URL |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend API key, if required by your configured service |

Storage credentials/settings may also be required for S3 uploads. Use the exact values expected by your environment. **Never commit `.env.local` or paste secrets into issues or chat.** Variables prefixed with `VITE_` are exposed to the browser build; never put private secrets in them.

### 4. Prepare the database

Make sure the database exists and `DATABASE_URL` is correct, then run:

```bash
pnpm db:push
```

This project uses Drizzle to generate and apply database migrations. Back up important data before changing a shared database.

### 5. Start the app

```bash
pnpm dev
```

Open **http://localhost:3000**. Keep the terminal running while you use the app; press `Ctrl+C` to stop it.

## Use the app

1. Sign in through the configured authentication provider.
2. Upload a `.txt` or `.md` document.
3. Wait for processing/indexing to finish.
4. Ask a question about the uploaded content.
5. Check the answer's source references. If no relevant text is found, try a more specific question or a document containing the answer.

## Common errors

| Error / symptom | What to check |
| --- | --- |
| `pnpm: command not found` | Enable/install pnpm with the Corepack commands above, then reopen the terminal. |
| `ECONNREFUSED`, database connection error, or migration failure | Ensure MySQL/TiDB is running, the database exists, and `DATABASE_URL` has the correct host, port, username, password, and database name. |
| Missing environment variable / embedding service is not configured | Check that `.env.local` exists in the project root and contains the required values. Restart `pnpm dev` after editing it. |
| AI API returns HTTP 401 or 403 | Check the API key and whether it has permission to use the configured service. |
| AI API returns HTTP 404 | Check the API base URL and endpoint configuration. |
| AI API returns HTTP 429 | The service may be rate-limiting you or your quota may be exhausted. Wait, check usage/billing, and retry. |
| PDF upload says extraction is not configured | Expected in this branch. Use a `.txt` or `.md` file until PDF parsing is implemented. |
| Port 3000 is already in use | Stop the other process using the port, then run `pnpm dev` again. |
| Blank page or frontend errors | Check the browser developer console and the terminal for the first error; confirm dependencies installed successfully. |
| Login/OAuth fails | Verify the app ID, OAuth server URL, provider configuration, and allowed callback URL with your environment administrator. |
| Upload fails at storage | Check S3/storage credentials, bucket permissions, and endpoint configuration. |
| App starts but answers have no useful sources | Confirm the document indexed successfully and contains selectable/readable text; ask a more focused question. |

For debugging, fix the **first** error shown in the terminal, then restart and try again. Do not share API keys, passwords, session cookies, or full secret-bearing environment files when asking for help.

## Useful commands

```bash
pnpm dev       # Start development server
pnpm check     # TypeScript check
pnpm test      # Run tests
pnpm build     # Build for production
pnpm start     # Start production build
pnpm format    # Format files (may change many files)
```

If `pnpm test` reports that no tests were found, test files may not yet be configured. Run `pnpm check` and `pnpm build` as additional checks.

## How it works

1. **Upload:** document text is extracted and the file is stored.
2. **Chunk:** the text is split into smaller, overlapping pieces.
3. **Embed:** the AI embedding service converts each piece into a numeric vector.
4. **Retrieve:** a question is embedded and similar document chunks are selected.
5. **Answer:** the language model uses retrieved passages to generate a response with sources.

## Project structure

```text
client/                 React frontend
server/ragRouter.ts     Upload, retrieval, and chat API procedures
server/documentProcessor.ts  Text extraction, chunking, and embeddings
server/db.ts            Database operations
server/_core/           Server and framework setup
drizzle/                Database schema and migrations
shared/                 Shared types and utilities
```

## Before production

- Configure production secrets and storage/database permissions securely.
- Add automated tests for chunking, failed embeddings, and document cleanup.
- Add a real PDF parser and test scanned-PDF behavior separately (scanned files need OCR).
- Run `pnpm check`, `pnpm test`, and `pnpm build`.
- Review authentication, upload limits, logging, and deployment configuration before exposing the app publicly.

## Open source and community contributions

RAG Agent is released under the [MIT License](LICENSE). Contributions from the community are welcome, including bug fixes, tests, documentation, UI/accessibility improvements, retrieval quality improvements, and new features.

- Read the [Contributing Guide](CONTRIBUTING.md) before opening a pull request.
- Follow our [Code of Conduct](CODE_OF_CONDUCT.md).
- [Report a bug](https://github.com/USERASHOKG/rag-agent/issues/new?template=bug_report.md) or [suggest a feature](https://github.com/USERASHOKG/rag-agent/issues/new?template=feature_request.md).
- For substantial changes, open an issue first so the approach can be discussed.

All contributions are reviewed before merging. Please do not include secrets, private documents, or credentials in commits or issues.
