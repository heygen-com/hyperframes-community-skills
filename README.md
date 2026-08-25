# HyperFrames Community Skills

[![Validate community skills](https://github.com/heygen-com/hyperframes-community-skills/actions/workflows/validate.yml/badge.svg)](https://github.com/heygen-com/hyperframes-community-skills/actions/workflows/validate.yml)

A community-maintained collection of focused, one-off skills for
[HyperFrames](https://github.com/heygen-com/hyperframes).

This repository is for useful skills built around a specific workflow, tool, or
use case that do not belong in HyperFrames' curated public skill set. Each
directory under `skills/` is independent and can be installed on its own.

> [!CAUTION]
> Community skills are not part of the curated HyperFrames distribution. A
> skill can instruct an agent to run commands, read files, call network services,
> or spend money. Review its `SKILL.md`, scripts, dependencies, and requested
> permissions before using it. Repository review and automated checks reduce
> risk, but they are not a security guarantee.

## Available skills

| Skill | What it does |
| --- | --- |
| [`p5-paint-animation`](skills/p5-paint-animation/) | Turns text, photos, and short clips into deterministic p5.js handwriting, paint-on, and living-painting animations. |
| [`vox-explainer`](skills/vox-explainer/) | Builds 60–90 second, collage-style HyperFrames explainers from a topic, document, or link. |

## Install skills

This repository uses the same
[`skills`](https://github.com/vercel-labs/skills) installer as HyperFrames.
List the available skills without installing anything:

```bash
npx skills add heygen-com/hyperframes-community-skills --list
```

### Install one skill

Replace `<skill-name>` with the name of a directory under `skills/`:

```bash
npx skills add heygen-com/hyperframes-community-skills --skill <skill-name>
```

### Install all skills

```bash
npx skills add heygen-com/hyperframes-community-skills --all
```

By default, `skills add` installs into the current project and prompts for the
agents to target. Use its `--global`, `--agent`, and `--yes` options when you
need a global or non-interactive install.

This repository is public, so installation does not require GitHub
authentication.

## Download without installing

To download one skill without installing it automatically:

```bash
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/heygen-com/hyperframes-community-skills.git
cd hyperframes-community-skills
git sparse-checkout set skills/<skill-name>
```

The skill will be at `hyperframes-community-skills/skills/<skill-name>`.

To download the complete collection:

```bash
git clone --depth 1 \
  https://github.com/heygen-com/hyperframes-community-skills.git
```

To update a clone later, run `git pull --ff-only` inside it. Review incoming
changes before installing or copying the updated skills.

## Repository layout

Every skill is self-contained:

```text
skills/
└── <skill-name>/
    ├── SKILL.md          # Required instructions and metadata
    ├── scripts/          # Optional readable source code
    ├── references/       # Optional supporting documentation
    └── assets/           # Optional small, redistributable assets
```

Skill directory names use lowercase kebab-case and must match the `name` field
in `SKILL.md`. This native `skills/` layout lets the installer discover the
collection without a broad `--full-depth` scan. There is no root skill and no
shared runtime dependency between skills.

## Contribute

Contributions are welcome when a skill is:

- useful for a concrete HyperFrames workflow;
- narrow enough to understand and review independently;
- self-contained, documented, and tested;
- explicit about network access, credentials, paid services, and side effects;
- made from readable source without bundled secrets or opaque executables.

All changes go through a pull request, code-owner review, structural validation,
and secret scanning. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full quality
and safety bar.

Use [GitHub Issues](https://github.com/heygen-com/hyperframes-community-skills/issues)
for bug reports and skill proposals. Report security problems privately as
described in [SECURITY.md](SECURITY.md), and follow our
[Code of Conduct](CODE_OF_CONDUCT.md) when participating.

## Curated vs. community skills

Use the curated HyperFrames skills for common, supported workflows. Use this
repository for specialized or experimental workflows whose smaller audience
does not justify inclusion in the public set. Inclusion here does not imply that
a skill will graduate into the curated distribution.

## License

Apache 2.0. See [LICENSE](LICENSE).
