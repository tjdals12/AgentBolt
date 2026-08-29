---
name: agent-bolt
description: "Manages a project's AI assets — skills, subagents, and guidelines — through the agent-bolt CLI. Use when the user wants agent-bolt set up in a project, asks what a catalog or pack offers or what an item does, wants items picked, installed, or removed, or asks whether the installed files still match the config. Not for authoring catalog content, and not for doing the installed assets' work: this skill delegates to the agent-bolt CLI."
compatibility: Requires the agent-bolt CLI.
---

agent-bolt pulls skills, subagents, and guidelines from a catalog — a local
directory or a git repository, grouped into packs — records what the project
wants in `.agent-bolt/catalog-config.yml`, and installs it into every
configured tool in that tool's own format. Installed files are named
`bolt-<source>-<pack>-<item>` and belong to the CLI: they are regenerated on
every sync and are never edited by hand.

Run every command from the project root, always in the same shape: `--json`
plus every selection option spelled out.

- For options, flags, and valid values, ask the CLI itself:
  `agent-bolt <command> --help`.
- With `--json`, a command missing its selections refuses with an error naming
  exactly what is required. Without `--json` it opens an interactive picker
  meant for a human at a terminal — never rely on the picker.
- Success prints the result object on stdout. Failure prints
  `{"error": {"message": "…"}}` and exits 1, and the message usually names the
  fix or the next command — relay it and act on it. Progress lines go to
  stderr; parse stdout only.
- `add-*` and `remove-*` edit the config file only. `sync` is the only command
  that writes or deletes project files — run it only after the user approves.

Response shapes, exit codes, and command behavior:
[references/json-responses.md](references/json-responses.md).

**Pick a flow**

- The user wants agent-bolt in this project → **Set up agent-bolt**
- The user has a catalog to hook up to an existing setup → **Add a catalog to an existing setup**
- The user asks what a catalog offers, or what an item is → **Explore the catalog**
- The user asks what would fit the project → **Recommend items for the project**
- The user wants items installed → **Install items**
- The user wants items gone → **Remove items**
- The user asks whether installs are current, or CI failed on `check` → **Audit the installation**
- A command failed because agent-bolt is missing → **When agent-bolt is not set up**

## Set up agent-bolt

**Steps**

1. **Check for an existing setup.** If `.agent-bolt/catalog-config.yml`
   exists, setup is done — move to the other flows. Re-running `init` on an
   existing config fails and points at `--force`; `--force` replaces the
   whole config — tools, sources, and every pack selection — so use it only
   when the user explicitly wants to start over.

2. **Settle the tools and the catalog with the user.** Valid tool ids and
   the source spec are in `agent-bolt init --help`. `init` refuses to run
   without at least one source, so the catalog comes first. When no catalog
   is connected yet, work through these with the user, in order:
   - **An existing catalog** — a local directory or a git repository the
     user or their team already maintains. Ask where it lives; confirm a
     directory is a catalog with
     `agent-bolt catalog validate --dir=<path> --json`.
   - **The starter catalog** — ready-made content to try agent-bolt with:
     `git:https://github.com/tjdals12/AgentBoltCatalog.git`.
   - **A new catalog** — authoring one is its own workflow, done with the
     `agent-bolt catalog` commands; offer it as a separate task.

   **A local catalog path is stored and resolved relative to `.agent-bolt/`,
   not the project root**: a catalog directory at
   `<project>/.agent-bolt/catalog` is `local:./catalog`.

3. **Initialize**

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

   `orphanedSources` lists pack selections that were dropped because their
   source alias no longer exists — relevant only with `--force` over an old
   config.

4. **Verify the source.** `init` does not check that the catalog is reachable.
   Run `agent-bolt list-packs --json` and confirm `failures` is empty — a
   wrong local path surfaces here, not at `init`:

   ```json
   {
     "sources": [],
     "failures": [
       "source 'common': catalog path not found: /work/acme/.agent-bolt/catalog (check 'path: ./catalog' in config - relative to .agent-bolt/)"
     ]
   }
   ```

## Add a catalog to an existing setup

No CLI command edits `sources` — connecting another catalog to an existing
config is a hand edit.

**Steps**

1. Add the source under `sources` in `.agent-bolt/catalog-config.yml`,
   following
   [references/catalog-config-schema.md](references/catalog-config-schema.md).
   A local `path` is relative to `.agent-bolt/`.
2. Verify with `agent-bolt list-packs --json` — the new alias appears under
   `sources` and `failures` stays empty.
3. Select and install its content via **Install items**.

**Guardrails**

- Never use `init --force` to add a source — it replaces the whole config,
  dropping every pack selection.

## Explore the catalog

**Steps**

1. **List the packs**

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
           },
           {
             "name": "common",
             "description": "Core development workflow shared across the team — commit/PR creation, business analysis, and more.",
             "counts": { "skills": 4, "agents": 8, "guidelines": 3 }
           }
         ]
       }
     ],
     "failures": []
   }
   ```

   A source that cannot be loaded lands in `failures` while the command still
   exits 0 — read `failures` before trusting `sources`.

2. **List the items of the packs that look relevant** — trimmed response:

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
                   "description": "Generate Conventional Commits messages, stage changes if needed, and run git commit/amend. Use when the user explicitly asks to commit or amend, or asks to generate a commit message from the current/staged diff."
                 }
               ],
               "agents": [
                 {
                   "name": "code-reviewer",
                   "description": "Use after code has been written or modified and needs review for quality, correctness, and adherence to best practices. Trigger this agent after significant code changes are made."
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
                   "description": "Project-wide TypeScript coding standards: typing, naming, imports, function/class design, compiler options, and type performance.",
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

   A guideline's `recommended` is the load mode `add-pack`/`add-item` will
   write into the config: `always`, or `conditional` with the globs it applies
   to.

3. **Organize what you found and present it.** Group by pack, and give every
   item the same labeled shape, filled from its description. Present all of
   it — this flow filters nothing.

   ```text
   common — core development workflow shared across the team
     create-commit · skill
       summary:      generates Conventional Commits messages, stages
                     changes when needed, and runs git commit
       recommended:  you want every commit written in one consistent format
     code-reviewer · agent
       summary:      reviews written or modified code for correctness and
                     quality, labeled by severity
       recommended:  you want changes reviewed before they land
     commit-rules · guideline · load: always
       summary:      commit message format and commit granularity rules,
                     kept in four lines
       applies:      every agent's context, at all times
   ```

   Every kind renders in this shape; only the second label differs —
   `recommended:` for skills and agents, `applies:` for guidelines.

4. **Show an item the user asks about** — the response carries the whole
   item, body included (trimmed here):

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
         "description": "Generate Conventional Commits messages, stage changes if needed, and run git commit/amend. Use when the user explicitly asks to commit or amend, or asks to generate a commit message from the current/staged diff.",
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

   `instructions` is the exact content the item installs, and the only place
   its real behavior is written down. `assets` are extra files the item ships
   with; `toolConfig` is the per-tool settings it carries.

## Recommend items for the project

A recommendation is built from four inputs, gathered in order: the catalog
map, the project, the bodies of the candidates, and the user's answers —
descriptions narrow the field, bodies carry the verdict, questions cover
what the code cannot say. The judgment is yours, made in this conversation;
every final call is the user's.

**Steps**

1. **Map the catalog.** `agent-bolt list-packs --json` and
   `agent-bolt list-items --json` across every source — the map is every
   item the catalog offers.

2. **Read the project.** Stack, structure, configuration, tooling. It
   qualifies candidates for step 3, and it answers questions before step 4
   needs to ask them.

3. **First list — what fits now.** Pick the items the project as it stands
   supports, read the body of each with `show-item`, and keep the ones whose
   body delivers what the description promises and whose prerequisites the
   project meets. Judge each kind by what installing it costs:

   | Kind      | Installed, it…                         | So judge it…                                                                      |
   | --------- | -------------------------------------- | --------------------------------------------------------------------------------- |
   | guideline | is injected into every agent's context | strictly — one that prescribes what the project does not have is actively harmful |
   | skill     | runs only when invoked                 | on quality and on whether its prerequisites exist                                 |
   | subagent  | is a role, used when delegated to      | on whether the project needs that role's work                                     |

4. **Second list — what the user plans.** Every item the map holds that
   step 3 did not keep, and that the code has not already answered, goes
   into a question: partition those items into areas and ask about them
   all. An area is one kind of work — a technology, a workflow, a role
   — so items serving the same work share one question, and items serving
   different work get their own: two ORM skills are one question ("which
   one, if any"), two role agents for different work are two. The question
   itself carries the presentation — shape it like this:

   ```text
   Which of these role agents does the project need? (none is fine)

     [ ] business-analyst
         summary:      maps as-is business processes, elicits requirements,
                       and finds process gaps
         recommended:  requirements analysis will be delegated to an agent
     [ ] ux-researcher
         summary:      plans user research and turns findings into
                       actionable insights
         recommended:  user research happens in this project
   ```

   Items that do not fit one prompt go into the next, along the same work
   boundaries. A yes sends those items through step 3's body check. When
   the session cannot ask, or an asked question gets no answer, carry the
   area into step 5 marked "needs confirmation" together with the question
   that would settle it.

5. **The record — what was not taken.** Every item on the map ends in a
   kept list or here, and it arrives here only through step 4 — declined,
   its `recommended:` line naming what would bring it back, or unanswered,
   under the question that would settle it. Entries keep the labeled shape
   of **Explore the catalog** step 3. Descriptions carry them; read a body
   only when the user picks an item up.

6. **Report and hand over.** Report every group — each entry with what
   decided it — answering from the body where the user hesitates. An open
   question from the record can be settled right there; the flow ends when
   every item on the map is chosen, declined, or recorded with its
   question. The chosen set goes through **Install items**. The shape of
   the report:

   ```text
   Fits now — bodies read and verified
     common/create-commit · skill
       summary:  writes Conventional Commits messages from the diff
       why:      the body assumes nothing beyond git, which the project has
     common/commit-rules · guideline · load: always
       summary:  four lines of commit format rules
       why:      matches create-commit, and light enough to sit in every
                 agent's context

   Planned — confirmed in this conversation
     backend/prisma-expert · skill
       summary:  schema, migration, and query optimization playbook
       why:      Prisma confirmed for this project

   Declined — with what would bring each back
     common/ux-researcher · agent
       summary:      plans user research and turns findings into
                     actionable insights
       recommended:  user research happens in this project
     frontend/react-dev · skill
       summary:      React implementation patterns for components, state,
                     and effects
       recommended:  a React frontend is added

   Needs confirmation — one answer settles each
     will this repo push to a remote and use PRs?
       create-pr · skill
         summary:      opens pull requests with a standard body via gh
         recommended:  a GitHub remote with a PR workflow is in place

   Shall I install the "fits now" and "planned" lists? The open question
   can be answered any time, and I can read any item's body for a closer
   look.
   ```

**Guardrails**

- Never claim an item fits before reading its body — and read the bodies
  of candidates, not of the whole catalog.
- Derive every question from items that exist. When no item hangs on the
  answer, there is no question.
- Prompt options follow the question shape of step 4; an item that does not
  fit a prompt moves into the next one.
- Questions and the report are the flow's only output.
- Say what a guideline imposes before recommending it — its body lands in
  the project's rules or instructions file as written.

## Install items

**Steps**

1. **Agree on the set with the user** — via **Explore the catalog** or
   **Recommend items for the project**.

2. **Record the selection.** Whole packs:

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

   Specific items:

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

   `created: true` means the pack section was newly added to the config;
   `skipped` holds names that were already selected. Nothing is installed yet
   — these commands edit `.agent-bolt/catalog-config.yml` and stop.

3. **Adjust guideline load modes if the user wants them different.**
   Selections land with the catalog's `recommended` load mode. Changing
   `load`/`glob` afterward is done by editing the config file by hand — see
   [references/catalog-config-schema.md](references/catalog-config-schema.md).

4. **Preflight the shared instructions file.** Some tools install guidelines
   into a shared instructions file, fenced by a marker block the CLI owns
   (e.g. Codex and OpenCode, which share `AGENTS.md`). If guidelines are being
   installed for such a tool, check that file first:
   - The file does not exist → fine; `sync` creates it, markers included.
   - The file exists and has `<!-- bolt:start -->` and `<!-- bolt:end -->` →
     fine.
   - The file exists without markers → **ask the user where the block should
     go** (suggest the end of the file), insert the two marker lines there,
     then sync. Never place the markers without asking: the file is the
     user's, and the position decides how their own instructions and the
     managed block read together.

5. **Sync, with the user's approval**

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

   Statuses are `installed` (newly written), `updated` (rewritten), `removed`
   (deleted). Report the changes per tool.

6. **If sync fails on the marker block**, it stopped midway — items for other
   targets are already written, only the block is not:

   ```json
   {
     "error": {
       "message": "No bolt managed block markers found. Add the markers below where you want the block, then run `agent-bolt sync` again.\n\n<!-- bolt:start -->\n<!-- bolt:end -->"
     }
   }
   ```

   Add the markers as in step 4 and run `sync` again; it reconciles the rest.

**Guardrails**

- Never run `sync` without the user's approval — it writes and deletes files
  across the project.
- Never report an item as installed while it is only in the config.
- Do not add items the user has not agreed to, however useful they look.

## Remove items

**Steps**

1. **Record the removal.** Specific items:

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

   `pruned: true` means the pack section became empty and was dropped from the
   config. Whole packs:

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

2. **Sync, with the user's approval.** The installed files stay on disk until
   then (`check` reports them as `orphaned` in the meantime):

   ```json
   {
     "tools": [
       {
         "tool": "claude",
         "counts": { "skills": 3, "agents": 2, "guidelines": 6 },
         "changes": [{ "source": null, "label": "common/commit-rules", "status": "removed" }]
       },
       {
         "tool": "codex",
         "counts": { "skills": 3, "agents": 2, "guidelines": 6 },
         "changes": [{ "source": null, "label": "AGENTS.md (managed block)", "status": "updated" }]
       }
     ]
   }
   ```

## Audit the installation

**Steps**

1. **Check**

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

   When `drifted` is `true` the command exits 1 — that is what fails a CI
   step. Empty `changes` everywhere and `drifted: false` mean the project
   matches the config.

2. **Read the statuses**

   | Status     | Meaning                                                              |
   | ---------- | -------------------------------------------------------------------- |
   | `missing`  | Selected in the config but not installed yet                         |
   | `drifted`  | Installed, but its content differs from what the catalog renders     |
   | `orphaned` | Installed, but no longer selected in the config (`source` is `null`) |

3. **Reconcile with `sync`, with the user's approval** — it installs the
   missing, rewrites the drifted, and deletes the orphaned. Before syncing
   over a `drifted` entry, tell the user the file was changed on disk and
   would be overwritten: if the change is worth keeping, it belongs in the
   catalog, not in the installed copy.

**Guardrails**

- Never edit installed `bolt-*` files to fix drift — sync regenerates them
  wholesale, and extra files placed inside an installed skill directory are
  deleted on the next sync.
- `check` never modifies anything; it is always safe to run.

## When agent-bolt is not set up

- `agent-bolt: command not found` → install it:
  `npm install -g @tjdals12/agent-bolt`.
- A command fails saying the config was not found → run **Set up agent-bolt**.
- Anything else that fails prints `{"error": {"message": "…"}}` — the message
  usually names the fix; relay it and act on it.
