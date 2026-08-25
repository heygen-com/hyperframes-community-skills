## What

<!-- What skill or behavior does this PR add or change? -->

## Why it belongs here

<!-- What focused use case does it serve, and why is it not part of the curated public skills? -->

## Trust boundary

<!-- List commands, file access, network destinations, credentials, paid operations, and externally visible side effects. Write "None" where applicable. -->

## Verification

<!-- Describe the fresh-session tests you ran and include non-sensitive evidence. -->

## Checklist

- [ ] The skill is self-contained and its directory name matches `SKILL.md`.
- [ ] New or renamed skills are linked in the README's **Available skills** table.
- [ ] I read every instruction and script in the submitted skill.
- [ ] I disclosed all dependencies, network access, credentials, costs, and side effects.
- [ ] No secrets, private data, private endpoints, generated output, or opaque executables are included.
- [ ] Destructive, paid, or externally visible actions require explicit user confirmation.
- [ ] Dependencies are minimal, pinned where practical, and license-compatible.
- [ ] I tested the normal path and a failure or cancellation path in a fresh agent session.
- [ ] `bash .github/scripts/validate-skills.sh` passes locally.
