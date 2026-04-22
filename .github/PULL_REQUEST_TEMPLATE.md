<!--
Thanks for the PR. Please fill this out so review can start from context.
Keep the PR small — one logical change per PR.
-->

## Summary

<!-- What does this PR do, and *why*? The "why" is what review starts from. -->

## Linked issue

Closes #

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor (no behavior change)
- [ ] Docs
- [ ] Chore / tooling
- [ ] Security fix (also notify maintainers per SECURITY.md before merging)

## Security impact

- [ ] This PR does not touch signing, verification, auth, or key handling.
- [ ] This PR touches security-sensitive code. I have described the impact below.

<!-- If security-sensitive: describe the threat model change, new inputs trusted, new outputs signed, etc. -->

## Checklist

- [ ] `npm run test` passes locally.
- [ ] `npm run lint` passes locally.
- [ ] I added / updated tests for new behavior (unit or integration, whichever fits).
- [ ] Credential-related changes include a round-trip test (issue → serialize → verify → detect tamper).
- [ ] I updated docs under `docs/` and the README where relevant.
- [ ] No new top-level dependencies without discussion.
- [ ] No secrets, keys, or real identity data in the diff or in fixtures.

## Screenshots / output

<!-- For UI or CLI output changes, paste before/after. Optional otherwise. -->
