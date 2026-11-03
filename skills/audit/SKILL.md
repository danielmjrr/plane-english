---
name: audit
description: Audits the instructions the user owns (CLAUDE.md and imports, rules, memory, agents, skills, prompt-injecting hooks) for conflicts with the Plane English output style, proposes one minimal edit per conflict, and applies only approved edits. Never edits the plugin or the style. Use when the user runs /plane-english:audit, adopts the plugin long-term and wants existing conflicts removed, asks why replies still narrate or still run long, or asks which of their rules fight the style.
---

# Plane English audit

Each conflict left in place costs tokens on every turn, because Claude must decide which rule wins.
The aim is to remove that decision. Propose every edit, and apply only the edits that the user approves.

## Step 0: Set the mode

- **Full** (default): all steps.
- **`--report`** (if the user's message contains it): do Steps 1, 3, and 4, print the findings, and stop.
  No backup, no proposal, no edit.

## Step 1: Collect the file set

Write one script that prints paths and byte counts, never file bodies.

**Editable:**

- `~/.claude/CLAUDE.md`, plus every file it imports with `@path`, recursively.
- `~/.claude/rules/*.md`
- `~/.claude/MEMORY.md` and `~/.claude/projects/*/memory/*.md`
- The project: `./CLAUDE.md`, `./AGENTS.md`, `./.claude/CLAUDE.md`, `./.claude/rules/*.md`, and any
  nested `CLAUDE.md` below the root. Skip `node_modules` and other vendored directories.
- `~/.claude/agents/*.md` and `./.claude/agents/*.md`, bodies and frontmatter.
- `~/.claude/skills/*/SKILL.md` and `./.claude/skills/*/SKILL.md`.
- `~/.claude/output-styles/*.md`.

**Report only, never edit:**

- Anything under `~/.claude/plugins/cache/**`, because the next plugin update erases an edit there.
- Any file that `git ls-files --error-unmatch <path>` reports as tracked, because an edit there becomes public.
- The hooks: the `hooks` block of `~/.claude/settings.json`, `./.claude/settings.json`, and
  `./.claude/settings.local.json`, plus `hooks.json` in every installed plugin. A `UserPromptSubmit`
  or `SessionStart` hook outranks a rules file. List each hook that injects prose about how a reply
  reads, with its file.

**Never scan or flag:**

- This plugin's own directory and the style file.
- The block between `<!-- plane-english:output-style:begin -->` and `:end` in any `CLAUDE.md`.
- Text in a fenced code block or a quoted example. A rule that quotes the style does not fight it.

## Step 2: Back up

In full mode, do this before the scan, so the files are safe before the user sees what can change.

Write one script that copies every editable file into
`~/.claude/backups/plane-english-audit-<YYYY-MM-DD-HHMM>/` with its relative path. It prints only the
count and the destination. Do not back up plugin files or `settings.json`, because this skill does
not edit them. Then print a one-line restore command, so the user can undo the run without you.

## Step 3: Scan

Grep the editable set for these signals. Read only the matching lines with two lines of context.

| Signal | Example phrases |
|---|---|
| Narration and recap | narrate, step by step, walk through, recap, summarise what you did, explain your reasoning |
| Length | concise, brief, verbose, under N lines, no more than, keep responses, one paragraph, three lines |
| Shape | format your response, respond with, always start with, always end with, output format, bullet, table, emoji, headers |
| Tone and wording | friendly, casual, no preamble, be direct, em dash, tone |
| Summary blocks | summary section, TL;DR, closing summary, final recap |

## Step 4: Classify each match

Ask: does the line constrain the shape, length, wording, or narration of a reply to the user?

- **Yes, opposite to the style:** hard conflict.
- **Yes, same as the style:** duplicate.
- **Yes, but it does not say if it covers a chat reply or a written artifact:** ambiguous scope.
- **No, it constrains the work** (what to build, verify, deliver, or refuse): clear. Do not flag,
  edit, or mention it.

## Step 5: Choose the resolution

Take the first rung that ends the conflict, because each lower rung leaves a decision for runtime.

1. **Delete.** The line covers only reply shape, and the style covers it too. Delete the line, or the
   file if nothing else remains.
2. **Rewrite to work only.** Cut the reply-shape clause, and keep the work clause word for word.
3. **Narrow the scope.** Add one clause that names the artifact, such as `in commit messages`. The
   condition must apply with no judgment.
4. **State precedence.** Only when the user wants the line kept as written, add:
   `The Plane English output style wins on reply shape.`

Change the fewest words that end the conflict. Do not rewrite a paragraph that the user tuned.

## Step 6: Present the findings and stop

List hard conflicts, then ambiguous scope, then duplicates. Number the items across all files. Give
each item four lines:

```
3. ~/.claude/rules/workflow.md:22, hard conflict
   Now:  End every reply with a summary of the steps you took.
   Edit: delete the line
   Why:  the style bans step narration, so the two orders cannot both hold
```

After the list, name the report-only findings from Step 1, with no number. If the list has more than
20 items, show the hard conflicts and offer the rest in a second round. Then ask, and wait:

> Approve by number (`3, 5, 9`), by group (`all hard conflicts`), all of them (`all`), or none.

Silence is not approval. Approval of items 3 and 5 covers those two items, not the file that holds them.

## Step 7: Apply

Apply only the approved items, one at a time, with the Edit tool.

- If you delete a memory file, remove its line from `MEMORY.md` in the same step.
- Report the bytes removed from `~/.claude/rules/` and from each `CLAUDE.md`.
- If an edit fails, name it, keep the other edits, and give the backup path again.

## Step 8: Confirm

The run writes no report file. Give four lines at most:

1. The number of conflicts found and resolved.
2. What is left and why: kept by choice, or in a report-only file. Name those files.
3. The backup path and the restore command.
4. Hooks, tracked files, and plugin files were reported, never changed.

Then stop.
