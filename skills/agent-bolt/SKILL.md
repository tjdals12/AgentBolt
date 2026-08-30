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

No command produces a recommendation. This flow assembles one from the catalog
and the project, settles it with the user, and hands the result to
**Install items**.

**Steps**

1. **Map the catalog.** `--source` and `--packs` are optional filters; leave
   both off.

   ```bash
   agent-bolt list-items --json
   ```

   The response holds every pack of every source, each item with its name and
   description — the working set for the rest of the flow. One call is enough:
   `list-packs` only adds counts, which are the lengths of these lists.

   A source that lands in `failures` is a hole in the map — say so rather than
   recommending over it.

2. **Read the project.** Stay inside the repository; these are the sources:

   | Source                                            | What to take from it                                              |
   | ------------------------------------------------- | ----------------------------------------------------------------- |
   | dependency manifests and lockfiles                | the stack in use                                                  |
   | the repository tree                               | structure, tooling, and the workflows that run — tests, CI, hooks |
   | the README                                        | what the project is for, and any stack it says it is moving to    |
   | instruction files (e.g. `CLAUDE.md`, `AGENTS.md`) | conventions the user wrote down                                   |

   An instruction file may contain a block between `<!-- bolt:start -->` and
   `<!-- bolt:end -->`. Skip it: `sync` wrote that block from the current
   config, so it describes what is already installed, not what the project is.

3. **Decide who settles each item.** Work item by item, not pack by pack. Each
   description says what the item is for, and its assumption follows from that
   — a tool, a framework, a workflow, or a kind of work. Some descriptions
   state it outright.

   | The item assumes              | Settled by                                       |
   | ----------------------------- | ------------------------------------------------ |
   | something step 2 found        | the code — carry it forward as a candidate       |
   | something step 2 did not find | the user — step 4 asks whether it is planned     |
   | nothing                       | the user — step 4 asks whether that work happens |

4. **Ask about everything step 3 left to the user.** This turn's output is
   the prompts. Number each one `(current/total)` against the count you are
   sending — `(1/12)`, `(2/12)` — so the user can see how many are coming.

   Items that assume something step 2 did not find: group them by the
   assumption, one prompt per assumption, since a single answer decides every
   item in the group. Name every item in the group and what it does.

   ```text
   (1/12) Which of these does the project use, or plan to?

     [ ] a pull-request workflow on a hosted remote
           create-pr · skill       opens PRs with a standard body
           pr-review · skill       reviews a PR by number
           pr-rules · guideline    PR structure and review etiquette
   ```

   Items that assume nothing: every one of them gets its own option, since
   each stands alone and takes its own answer. Lead each option with the
   situation the item serves; the name follows. Check the ones step 2 found a
   trace of and say what the trace was; leave the rest unchecked. When there
   are more than a few, split them across prompts by theme — the theme is the
   prompt's question, never an option that swallows several items.

   ```text
   (2/12) Reviewing and hardening code — which of these happen here? I checked
   the ones I found traces of.

     [x] reviewing changes for correctness after they are written
           code-reviewer · subagent — CI runs on every pull request
     [x] building out the automated test setup
           test-automator · subagent — unit and e2e suites are already wired up
     [ ] holding the codebase to a written set of code-quality rules
           clean-code · skill
   ```

   When a prompt's options run longer than the user will read, ask first about
   the assumptions or the kinds of work, with every item accounted for by one
   of them, then list items only under what was picked.

   One option carries one assumption or one kind of work; items a user could
   want separately never share one.

   ```text
   Which of these does this project involve? I will list the items under
   whatever you pick.

     [ ] backend services and their data layer
     [ ] frontend applications
     [ ] product planning and user research
   ```

   If there is no user to answer — a non-interactive run — or a prompt goes
   unanswered, do not stall. Those items are undecided rather than declined,
   and step 5 reports them with the question that would settle them.

5. **Read the bodies, then report.** The candidate set closes with step 4's
   answers; then one `show-item` call per candidate. `instructions` is what
   the item installs, and a description can understate what the item takes —
   put the body through step 3's test again, and drop any candidate whose body
   assumes something step 2 did not find.

   Report in three parts: what survived, what the body check removed, and
   every question that went unanswered with the items it would settle. Name
   every item `source/pack/item`, and a guideline carries the load mode it
   would be selected with.

   ```text
   Ready to install
     common/common/create-commit · skill
       summary:  writes Conventional Commits messages from the diff
       why:      the body needs git and nothing else
     common/common/commit-rules · guideline · load: always
       summary:  four lines of commit format rules
       why:      a commit hook already enforces this format

   Removed after reading the body
     common/backend/testing-guidelines · guideline
       the body is written for a layered service layout this repo does not use

   Undecided — answer any of these and its items join the list above
     does this repo push to a remote and open PRs?
       common/common/create-pr · skill
       common/common/pr-review · skill
       common/common/pr-rules · guideline

   How would you like to proceed?
     1. install the ready-to-install list as it stands
     2. put common/backend/testing-guidelines back and install with it
     3. answer the open question first, then install
   ```

   Close with numbered options, one line each, and take every option from a
   section you just printed — a section with nothing in it offers nothing.

   When one of those questions gets answered later, read the bodies of its
   items the same way before adding them to the ready-to-install list.
   **Install items** starts from that list.

**Guardrails**

- Reserve `show-item` for candidates — reading the catalog's bodies to route
  them costs many times what the descriptions cost.
- Do not ask a question whose answer would not change what you recommend —
  every prompt is built from items in the working set.
- Say what a guideline's load mode means when recommending one: `always`
  applies it at all times, `conditional` only to files matching its globs.

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
