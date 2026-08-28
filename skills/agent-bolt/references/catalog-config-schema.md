# catalog-config.yml schema

`.agent-bolt/catalog-config.yml` declares which items, from which catalogs,
get installed for which tools. It is normally managed through the CLI
(`init`, `add-*`, `remove-*`). Two changes have no command and are made by
hand: editing `sources` — adding, changing, or removing a catalog after init
— and changing a guideline's `load`/`glob` (the CLI always writes the
catalog's recommended value).

After any hand edit, run `agent-bolt sync` (with the user's approval) to apply
it. A malformed config fails the next command with a validation error. The
config `init` generates begins with a commented template of these shapes.

## Complete example

```yaml
version: 1

# Tools to install items for
tools:
  - claude
  - codex

# Catalogs to pull items from (alias → source)
sources:
  common:
    type: local
    # Resolved relative to .agent-bolt/, NOT the project root
    path: ./catalog
  team:
    type: git
    url: https://github.com/acme/catalog.git
    # optional — branch or tag (default: the repo's default branch)
    ref: main
    # optional — when the catalog lives in a subdirectory of the repo
    subdir: catalog

# Selections (source alias → pack → items by type)
packs:
  common:
    backend:
      skills:
        - nestjs-expert
        - prisma-expert
      agents:
        - developer
      guidelines:
        # always: applied at all times
        commit-rules:
          load: always
        # conditional: applied only to files matching the globs
        prisma-schema:
          load: conditional
          glob:
            - prisma/**
```

## Field reference

| Field     | Rule                                                                                        |
| --------- | ------------------------------------------------------------------------------------------- |
| `version` | Must be `1`                                                                                 |
| `tools`   | Array of tool ids — the ones `agent-bolt init --help` lists for `--tools`                   |
| `sources` | Map of alias → source. Local: `{type: local, path}`. Git: `{type: git, url, ref?, subdir?}` |
| `packs`   | Map of source alias → pack name → selection. Optional; defaults to `{}`                     |

Selection per pack:

| Field        | Rule                                                     |
| ------------ | -------------------------------------------------------- |
| `skills`     | Array of item names. Optional; defaults to `[]`          |
| `agents`     | Array of item names. Optional; defaults to `[]`          |
| `guidelines` | Map of item name → load mode. Optional; defaults to `{}` |

Guideline load modes (`load` is a discriminator — exactly one shape or the
other):

```yaml
# Applied at all times
some-guideline:
  load: always

# Applied only to files matching the globs (at least one glob required)
other-guideline:
  load: conditional
  glob:
    - src/**/*.tsx
```

## Constraints worth knowing

- Pack and item names must be kebab-case: lowercase letters, digits, and
  hyphens (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
- A local source `path` is resolved relative to the `.agent-bolt/` directory.
  A catalog at `<project>/.agent-bolt/catalog` is `path: ./catalog`.
- A pack selection whose source alias is missing from `sources` is pruned the
  next time the config is rewritten (reported as `orphanedSources` by `init`).
- Renaming a source alias or a pack changes every installed file's name
  (`bolt-<source>-<pack>-<item>`), so the next sync removes the old files and
  installs new ones.
- Git sources are cloned fresh on every command that reads the catalog — no
  cache, so they need network access.
