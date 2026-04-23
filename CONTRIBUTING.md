# Contributing to RealH

Thanks for your interest. RealH is a security-sensitive project (we issue signed credentials), so the bar for changes is slightly higher than a typical web project. Please read this before opening a PR.

## Before you start

- **Bug fixes** — open an issue first if the fix is non-trivial. For trivial fixes, a PR is fine.
- **New features** — open an issue to discuss before writing code. Features that change the credential schema, key management, or verification flow need design review.
- **Security issues** — do not open a public issue or PR. See [SECURITY.md](SECURITY.md).

## Development setup

```bash
git clone https://github.com/ElMatiOfficial/realh.git
cd realh
npm install
npm run dev
```

Node 20+, npm 10+. The default `DEMO_MODE=true` needs no external services.

## Workflow

1. Fork the repo and create a branch off `main` (e.g. `fix/rate-limit-header`, `feat/oidc-provider`).
2. Make your change, keep commits focused.
3. Run `npm test` and `npm run lint` before pushing.
4. Open a PR using the template. Fill in the "why" — code review starts from motivation.

## Coding style

- JavaScript, ES modules throughout.
- Prefer small, well-named functions over comments.
- Don't introduce new top-level dependencies without discussion — every dep is supply-chain surface.
- Match the surrounding style. ESLint is configured; let it be the tiebreaker.

## Tests

- Server changes need vitest coverage. Integration tests over unit tests where it makes sense.
- Credential-related changes **must** include round-trip tests (issue → serialize → verify → detect tampering).
- Do not mock the crypto layer in verification tests. The real `jose` calls are cheap.

## Commits & PRs

- **Commit messages**: imperative mood, concise subject, body for the "why".
- **PR titles**: same style. Prefix with `fix:` / `feat:` / `docs:` / `chore:` / `security:` when it helps.
- **Keep PRs small**. One logical change per PR. Large rewrites get split.
- **Don't** force-push after review starts — it makes re-review painful.

## Security-sensitive changes

Changes in these areas require explicit review from a maintainer with the `security` label:

- `packages/server/src/services/keyManager.js`
- `packages/server/src/services/credentialService.js`
- `packages/server/src/middleware/authenticate.js`
- `packages/server/src/routes/wellknown.js`
- Anything touching signing, verification, or auth headers.

## Dependency updates

Dependabot opens PRs automatically. For manual updates:

- Pin exact versions for anything in the security-sensitive paths (`jose`, `firebase-admin`).
- Run `npm audit` after any dependency bump and note the output in the PR.

## Code of conduct

By participating, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## License & DCO

Contributions are licensed under [Apache-2.0](LICENSE). By opening a PR, you certify that you have the right to license your contribution under Apache-2.0 (Developer Certificate of Origin).
