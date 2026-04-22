# Security Policy

## Supported versions

RealH is pre-1.0. Security fixes are applied to the `main` branch only. Once we cut stable releases, this policy will list the supported version window.

## Reporting a vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

Report privately via one of:

1. **GitHub Private Vulnerability Reporting** (preferred) — on the repo's **Security** tab, click **Report a vulnerability**.
2. **Email** — send to `security@<your-domain>` (replace with the real address before publishing the repo). PGP key fingerprint will be published here when available.

Please include:

- A description of the issue and the potential impact.
- Steps to reproduce, ideally with a minimal PoC.
- The commit SHA or release tag you tested against.
- Your preferred credit (name / handle / anonymous).

## What to expect

- **Acknowledgement**: within 3 business days.
- **Initial assessment**: within 7 business days.
- **Fix timeline**: critical issues within 30 days; high within 60; medium/low on the next release.
- **Disclosure**: coordinated. We'll agree on a disclosure date with you before publishing an advisory. You'll be credited in the advisory unless you ask us not to be.

## Scope

In scope:

- The RealH server (`packages/server`) and client (`packages/client`).
- Credential issuance, verification, and key management logic.
- Authentication and authorization flows.
- Dependencies we pin directly (supply-chain issues affecting our lockfile).

Out of scope (report upstream):

- Vulnerabilities in third-party services (Firebase, GCP KMS, etc.) — report to the vendor.
- Issues that require an already-compromised host or root-level access.
- Denial-of-service by exhausting rate limits (the limits are the mitigation).
- Missing security headers on demo deployments clearly labelled as non-production.

## Safe harbor

We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction, and service disruption.
- Only interact with accounts they own or have explicit permission to test.
- Give us a reasonable time to respond before any public disclosure.
- Do not exfiltrate data beyond what is necessary to demonstrate the vulnerability.

## Cryptographic sensitivity

RealH issues signed credentials. **A leak of the signing key is a critical incident** because it lets an attacker forge credentials that verify against our public JWKS. If you believe you have found a key-exposure path (filesystem, logs, error messages, insecure defaults), treat it as critical and report immediately.
