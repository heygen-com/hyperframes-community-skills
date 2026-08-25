# Contributing

This repository collects focused HyperFrames skills that are useful to share
but are too specialized for the curated public skill set. Contributions should
be small enough for a reviewer to understand the complete behavior and trust
boundary.

## Before you start

- Search the repository for an existing skill that covers the same workflow.
- Search existing issues, and open a skill proposal before investing in a
  substantial new skill.
- Keep the skill self-contained. Do not add shared runtime code under `skills/`
  or at the repository root.
- Confirm that you have the right to redistribute every dependency and asset.
- Do not submit credentials, customer data, private URLs, or generated output.

## Skill structure

Create one lowercase kebab-case directory under `skills/`:

```text
skills/
└── my-specific-workflow/
    ├── SKILL.md
    ├── scripts/       # optional
    ├── references/    # optional
    └── assets/        # optional
```

`SKILL.md` must begin with YAML frontmatter whose `name` exactly matches the
directory:

```yaml
---
name: my-specific-workflow
description: Use when an agent needs to do a specific HyperFrames workflow.
---
```

The instructions should explain:

1. when to use and when not to use the skill;
2. required inputs, tools, dependencies, and credentials;
3. the workflow and its expected outputs;
4. network calls, paid operations, file changes, and other side effects;
5. how the agent and reviewer can verify success.

Use relative links for files owned by the skill. An agent reading only that
skill directory should have everything needed to follow it.

Add new and renamed skills to the **Available skills** table in `README.md`.
Link the skill name as `skills/<skill-name>/` and describe the concrete use case
in one sentence. Remove the empty-catalog message when adding the first skill.

## Safety and quality requirements

Pull requests will not be merged if they contain:

- secrets, tokens, personal data, private endpoints, or real credentials;
- obfuscated, minified, vendored, generated, or unexplained executable code;
- compiled executables, dynamic libraries, bytecode, or archives that hide
  reviewable source;
- symlinks, install-time execution, or undeclared downloads;
- silent telemetry, tracking, or data exfiltration;
- destructive actions without a safe default and explicit user confirmation;
- paid or externally visible actions without explicit user confirmation;
- broad filesystem, shell, or network access that the workflow does not need;
- unpinned dependencies where an upstream change could alter behavior;
- instructions that weaken authentication, authorization, sandboxing, or other
  security controls.

Scripts must be readable source, minimal, and directly necessary for the skill.
Prefer standard tools over adding dependencies. If a network service is needed,
name the service, the data sent to it, the credentials it uses, and whether it
can incur cost.

AI-assisted contributions are welcome, but the submitter remains responsible
for every instruction and script. Do not submit behavior you have not read,
understood, and tested.

## Test locally

Run the repository validator:

```bash
bash .github/scripts/validate-skills.sh
```

Then test the skill with a fresh agent session that has access only to the skill
and the dependencies documented in it. Exercise the normal path and at least one
failure or cancellation path. Do not use production credentials or sensitive
data in test fixtures or evidence.

## Open a pull request

Fork the repository, create a new branch from `master`, and open a pull request
against this repository. Keep it scoped to one skill or one coherent fix. In
the pull request:

- explain the use case and why it belongs in the community collection;
- enumerate commands, network destinations, credentials, costs, and side
  effects;
- describe the tests you ran and include non-sensitive evidence;
- disclose dependencies and licenses;
- call out any residual risk a user should understand.

All required checks must pass and a code owner must approve the exact head
commit. Resolve review threads before merge. Do not push directly to `master`.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
Contributions are licensed under the repository's Apache 2.0 license.
