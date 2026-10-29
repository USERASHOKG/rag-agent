# Contributing to RAG Agent

Thanks for helping improve RAG Agent! Bug reports, documentation, tests, and new features are welcome.

## Ways to contribute

- Report a reproducible bug or suggest a feature in GitHub Issues.
- Improve setup instructions or troubleshooting.
- Add tests or fix a bug.
- Propose improvements to retrieval, document processing, citations, accessibility, or the user interface.

## Before you start

1. Search existing issues and pull requests to avoid duplicate work.
2. For a large change, open an issue first to discuss the approach.
3. Keep changes focused. Avoid unrelated formatting or refactors.
4. Never commit API keys, passwords, tokens, private documents, or `.env.local`.

## Development setup

Follow the [README setup guide](README.md#run-locally). Create your own local `.env.local` with credentials for services you have access to. Do not use production secrets or data.

Useful checks:

```bash
pnpm check
pnpm test
pnpm build
```

If a command fails because a service or secret is unavailable, mention that in the pull request instead of claiming the check passed.

## Pull request checklist

- [ ] Explain the problem and why the change helps.
- [ ] Link the related issue, if there is one.
- [ ] Add or update tests where practical.
- [ ] Update documentation or environment-variable instructions when needed.
- [ ] Run relevant checks and report the actual results.
- [ ] Keep secrets, personal data, and unrelated files out of the diff.
- [ ] Include screenshots or steps to reproduce for UI changes.

## Pull request process

1. Fork the repository and create a branch from `main`.
2. Make your changes in small, clear commits.
3. Push the branch to your fork and open a pull request against `main`.
4. Respond to review feedback and update your pull request as needed.

Please be respectful and constructive. Maintainers may request changes before merging. Submitting a pull request does not guarantee it will be accepted.
