# HyperFrames Community Skills

A community-maintained collection of focused, one-off skills for
[HyperFrames](https://github.com/heygen-com/hyperframes).

This repository is for useful skills built around a specific workflow, tool, or
use case that do not belong in HyperFrames' curated public skill set. Each
top-level directory is an independent skill and can be installed on its own.

> [!CAUTION]
> Community skills are not part of the curated HyperFrames distribution. A
> skill can instruct an agent to run commands, read files, call network services,
> or spend money. Review its `SKILL.md`, scripts, dependencies, and requested
> permissions before using it. Repository review and automated checks reduce
> risk, but they are not a security guarantee.

## Install a skill

Replace `<skill-name>` with the name of a top-level skill directory.

### GitHub CLI

With GitHub CLI 2.90 or later:

```bash
gh auth login
gh skill install heygen-com/hyperframes-community-skills <skill-name>
```

`gh auth login` is only required when you are not already authenticated or the
repository requires access.

### Sparse checkout

To download one skill without installing it automatically:

```bash
git clone --depth 1 --filter=blob:none --sparse \
  git@github.com:heygen-com/hyperframes-community-skills.git
cd hyperframes-community-skills
git sparse-checkout set <skill-name>
```

The skill will be at `hyperframes-community-skills/<skill-name>`. Copy or link
that directory into the skills directory used by your agent.

## Download all skills

Clone the repository into a directory your agent scans for skills, or clone it
elsewhere and copy the skills you want:

```bash
git clone --depth 1 \
  git@github.com:heygen-com/hyperframes-community-skills.git
```

To update a clone later, run `git pull --ff-only` inside it. Review incoming
changes before making the updated skills available to an agent.

## Repository layout

Every skill is self-contained:

```text
<skill-name>/
├── SKILL.md          # Required instructions and metadata
├── scripts/          # Optional readable source code
├── references/       # Optional supporting documentation
└── assets/           # Optional small, redistributable assets
```

Skill directory names use lowercase kebab-case and must match the `name` field
in `SKILL.md`. There is no root skill and no shared runtime dependency between
skills.

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

## Curated vs. community skills

Use the curated HyperFrames skills for common, supported workflows. Use this
repository for specialized or experimental workflows whose smaller audience
does not justify inclusion in the public set. Inclusion here does not imply that
a skill will graduate into the curated distribution.

## License

Apache 2.0. See [LICENSE](LICENSE).
