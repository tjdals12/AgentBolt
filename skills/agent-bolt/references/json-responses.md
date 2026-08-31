# agent-bolt --json responses and exit codes

What each command prints with `--json`, what its fields mean, and how it
exits. Examples are real outputs; arrays may carry more elements than shown,
and long strings are elided with `…`. For options and flags, run
`agent-bolt <command> --help`.

## Contract

- Success prints the result object on stdout, pretty-printed, with no
  envelope. Failure prints `{"error": {"message": "…"}}` on stdout and exits
  1 — the presence of a top-level `error` key is the failure signal, and the
  message usually names the fix.
- Progress and warnings go to stderr. Parse stdout only.
- With `--json`, commands are strictly non-interactive: a missing selection
  fails with a message naming exactly what is required, instead of opening
  the interactive picker.
- Exit codes: `0` success; `1` any error; `check` also exits `1` when drift
  was found even though its JSON is a normal result object.

## init

```bash
agent-bolt init --tools=claude,codex --source common=local:./catalog --json
```

```json
{
  "configPath": "/work/acme/.agent-bolt/catalog-config.yml",
  "tools": ["claude", "codex"],
  "sources": {
    "common": { "type": "local", "path": "./catalog" }
  },
  "orphanedSources": []
}
```

- `orphanedSources`: pack selections dropped because their source alias no
  longer exists (only relevant with `--force` over an old config).
- `init` does not verify that a source is reachable — verify with
  `list-packs` afterward. A local source `path` is resolved relative to
  `.agent-bolt/`, not the project root.
- Re-running `init` on an existing config fails and points at `--force`,
  which replaces the whole config including every pack selection.

## list-packs

```bash
agent-bolt list-packs --json
```

```json
{
  "sources": [
    {
      "alias": "common",
      "type": "local",
      "packs": [
        {
          "name": "backend",
          "description": "Skills specialized for NestJS/Prisma backend development.",
          "counts": { "skills": 2, "agents": 2, "guidelines": 6 }
        }
      ]
    }
  ],
  "failures": []
}
```

- A source that cannot be loaded is reported in `failures` (one message per
  source) while the command exits 0 and the remaining sources are listed
  normally. Read `failures` before trusting `sources`.

## list-items

```bash
agent-bolt list-items --source=common --packs=common --json
```

```json
{
  "sources": [
    {
      "alias": "common",
      "type": "local",
      "packs": [
        {
          "name": "common",
          "description": "Core development workflow shared across the team — commit/PR creation, business analysis, and more.",
          "items": {
            "skills": [
              {
                "name": "create-commit",
                "description": "Generate Conventional Commits messages, stage changes if needed, and run git commit/amend. …"
              }
            ],
            "agents": [
              {
                "name": "code-reviewer",
                "description": "Use after code has been written or modified and needs review …"
              }
            ],
            "guidelines": [
              {
                "name": "commit-rules",
                "description": "Commit message conventions and granularity for this project.",
                "recommended": { "load": "always" }
              },
              {
                "name": "typescript-standards",
                "description": "Project-wide TypeScript coding standards: …",
                "recommended": {
                  "load": "conditional",
                  "glob": ["**/*.ts", "**/*.tsx"]
                }
              }
            ]
          }
        }
      ]
    }
  ],
  "failures": []
}
```

- Guidelines carry `recommended` — the load mode `add-pack`/`add-item` will
  write into the config.
- Unlike `list-packs`, a broken source fails the whole command (top-level
  `error`, exit 1).

## show-item

```bash
agent-bolt show-item --source=common --pack=common --item=create-commit --json
```

```json
{
  "source": "common",
  "pack": "common",
  "items": [
    {
      "type": "skill",
      "name": "create-commit",
      "description": "Generate Conventional Commits messages, stage changes if needed, and run git commit/amend. …",
      "toolConfig": {
        "claude": { "disable-model-invocation": true }
      },
      "instructions": "# Create Commit\n\n## Overview\n\nAnalyze the working tree, stage changes when nothing is staged, …",
      "instructionsPath": "/work/acme/.agent-bolt/catalog/packs/common/skills/create-commit/instructions.md",
      "assets": []
    }
  ]
}
```

- `type` is `skill`, `agent`, or `guideline`. `instructions` is the full body
  — it can be long. `assets` lists extra files a skill ships with.

## add-pack

Selects every item of the named packs. Edits the config only.

```bash
agent-bolt add-pack --source=common --packs=backend --json
```

```json
{
  "results": [
    {
      "source": "common",
      "added": [
        {
          "name": "backend",
          "skills": ["nestjs-expert", "prisma-expert"],
          "agents": ["architect-reviewer", "developer"],
          "guidelines": {
            "prisma-schema": { "load": "conditional", "glob": ["prisma/**"] },
            "testing-guidelines": { "load": "conditional", "glob": ["src/**/*.ts"] }
          }
        }
      ],
      "skipped": []
    }
  ],
  "failures": []
}
```

- `skipped` names packs that were already fully selected.
- Guidelines are written with their catalog-recommended load mode, shown in
  the response.

## add-item

Selects specific items of one pack. Creates the pack section in the config if
missing. Edits the config only.

```bash
agent-bolt add-item --source=common --pack=common --skills=create-commit --guidelines=commit-rules --json
```

```json
{
  "results": [
    {
      "source": "common",
      "packs": [
        {
          "name": "common",
          "created": true,
          "added": {
            "skills": ["create-commit"],
            "agents": [],
            "guidelines": ["commit-rules"]
          },
          "skipped": { "skills": [], "agents": [], "guidelines": [] }
        }
      ]
    }
  ],
  "failures": []
}
```

- `created: true` — the pack section was newly added to the config.
- `skipped` holds names that were already selected.

## remove-pack

Drops whole packs from the config. Edits the config only; installed files
stay until `sync`.

```bash
agent-bolt remove-pack --source=common --packs=backend --json
```

```json
{
  "results": [
    {
      "source": "common",
      "removed": [
        {
          "name": "backend",
          "skills": ["nestjs-expert", "prisma-expert"],
          "agents": ["architect-reviewer", "developer"],
          "guidelines": ["prisma-schema", "testing-guidelines"]
        }
      ],
      "skipped": []
    }
  ],
  "failures": []
}
```

## remove-item

Drops specific items of one pack from the config. Prunes the pack section if
it becomes empty. Edits the config only; installed files stay until `sync`.

```bash
agent-bolt remove-item --source=common --pack=common --guidelines=commit-rules --json
```

```json
{
  "results": [
    {
      "source": "common",
      "packs": [
        {
          "name": "common",
          "pruned": false,
          "removed": { "skills": [], "agents": [], "guidelines": ["commit-rules"] },
          "skipped": { "skills": [], "agents": [], "guidelines": [] }
        }
      ]
    }
  ],
  "failures": []
}
```

- `pruned: true` — the pack section became empty and was dropped.

## sync

Makes the project match the config: installs, rewrites, and deletes files for
every configured tool. The only command that writes project files.

```bash
agent-bolt sync --json
```

```json
{
  "tools": [
    {
      "tool": "claude",
      "counts": { "skills": 3, "agents": 2, "guidelines": 7 },
      "changes": [
        { "source": "common", "label": "common/create-commit", "status": "installed" },
        { "source": "common", "label": "common/commit-rules", "status": "installed" }
      ]
    },
    {
      "tool": "codex",
      "counts": { "skills": 3, "agents": 2, "guidelines": 7 },
      "changes": [
        { "source": "common", "label": "common/create-commit", "status": "installed" },
        { "source": null, "label": "AGENTS.md (managed block)", "status": "installed" }
      ]
    }
  ]
}
```

- `counts` is the number of items now selected per type; `changes` holds only
  what this run touched (an up-to-date project yields empty `changes`).
- `label` is `<pack>/<item>`; the shared instructions file appears as
  `AGENTS.md (managed block)` with `source: null`, as do deletions.
- Statuses: `installed` (newly written), `updated` (rewritten because content
  differed), `removed` (deleted because no longer selected).
- Marker failure — the shared instructions file exists without the marker
  block. The sync stopped midway (files written before the block stay
  written); add the markers, then re-run:

  ```json
  {
    "error": {
      "message": "No bolt managed block markers found. Add the markers below where you want the block, then run `agent-bolt sync` again.\n\n<!-- bolt:start -->\n<!-- bolt:end -->"
    }
  }
  ```

## check

Compares config, catalog, and installed files. Never modifies anything.

```bash
agent-bolt check --json
```

```json
{
  "tools": [
    {
      "tool": "claude",
      "counts": { "skills": 3, "agents": 2, "guidelines": 7 },
      "changes": [
        { "source": "common", "label": "frontend/react-dev", "status": "missing" },
        { "source": "common", "label": "common/create-commit", "status": "drifted" },
        { "source": null, "label": "common/commit-rules", "status": "orphaned" }
      ]
    },
    {
      "tool": "codex",
      "counts": { "skills": 3, "agents": 2, "guidelines": 7 },
      "changes": []
    }
  ],
  "drifted": true
}
```

- Exits 1 when `drifted` is `true` (any change anywhere) — suitable as a CI
  gate. The JSON body is still a normal result.
- Statuses: `missing` (selected but not installed), `drifted` (installed but
  content differs), `orphaned` (installed but no longer selected; `source` is
  `null`).
- `sync` resolves all three: installs the missing, rewrites the drifted,
  deletes the orphaned.

## Status names across sync and check

The same comparison, named from two directions:

| State of an item              | `check` reports | `sync` does, and reports |
| ----------------------------- | --------------- | ------------------------ |
| Selected, not installed       | `missing`       | writes it → `installed`  |
| Installed, content differs    | `drifted`       | rewrites it → `updated`  |
| Installed, no longer selected | `orphaned`      | deletes it → `removed`   |
