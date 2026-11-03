---
name: setup
description: Configures and activates the Plane English output style. Asks for the reader's role and English level, writes them to settings.json, resolves a competing copy of the style, and gives the /output-style plane-english:Plane English command. Use when the user runs /plane-english:setup, installs or reinstalls the plane-english plugin, wants to change their reading level or role, or asks why the style is not active.
---

# Plane English setup

A plugin install cannot ask questions, so this skill asks them. Run it once per machine. A re-run
offers the current values as defaults.

## Step 1: Check Node

Run `node --version`. Both hooks are Node scripts, and a hook that cannot start fails silently.

If the command fails, tell the user that the reminders and the reader profile do not run until `node`
is on `PATH`. The native Claude Code install does not always include `node`. The output style still
works, because it is a file. Continue the setup.

## Step 2: Read the current state

Read `~/.claude/settings.json`. Record `outputStyle`, `env.PLANE_ENGLISH_TECH_LEVEL`,
`env.PLANE_ENGLISH_ENGLISH_LEVEL`, and `env.PLANE_ENGLISH_CLAUDEMD`. Tell the user in one line which
of them are set.

## Step 3: Ask for the role

Ask in one line of prose, outside `AskUserQuestion`, because a free-text role says more than a preset:

> What is your role and seniority? For example `Senior Software Engineer`.

Use the answer word for word, for example `Staff SRE`. If the user skips it, keep the current role, or use `Software Engineer` when none is set.

## Step 4: Ask the two choices

Put both questions in one `AskUserQuestion` call. Use four options at most per question, because a
fifth option makes the call fail. Mark the recommended option, and mark the user's current value.

**Question: "How much do you want uncommon English words explained?"**

| Option | Description to show |
|---|---|
| `C1` (recommended) | Strong non-native reader. Plainer words win. |
| `Native` | Native speaker or reader. Full range of English. |
| `B2` | Good non-native reader. Uncommon words avoided. |
| `B1` | Basic non-native reader. Simple English. |

**Question: "Can the plugin add a pointer rule to your CLAUDE.md?"**

First say in one line: the pointer is a short block that names the style, so the rule survives a
`/compact`. No file changes unless the user picks `user` or `project`.

| Option | Description to show |
|---|---|
| `user` (recommended) | `~/.claude/CLAUDE.md`. Applies in every project on this machine. |
| `project` | The current project root's `CLAUDE.md` only. Nothing outside it changes. |
| `off` | Write nothing. No file is touched. |

## Step 5: Write settings.json

Edit `~/.claude/settings.json` with the Edit tool. Do not rewrite the file with a JSON dump, because
that reorders unrelated keys and can show a secret in the diff. Add the `env` object if it is not there.

```json
{
  "outputStyle": "plane-english:Plane English",
  "env": {
    "PLANE_ENGLISH_TECH_LEVEL": "<role answer>",
    "PLANE_ENGLISH_ENGLISH_LEVEL": "<level answer>",
    "PLANE_ENGLISH_CLAUDEMD": "<scope answer>"
  }
}
```

- Write only these keys, each value as a string.
- Write `native` in lower case.
- For `off`, remove `PLANE_ENGLISH_CLAUDEMD`. The hook treats unset as "do not write".
- Use the full ID `plane-english:Plane English`. The bare name `Plane English` does not load in a new
  session, and no error shows.

## Step 6: Resolve a competing pointer or copy

Report each collision. Delete nothing until the user agrees.

**A hand-written pointer.** If the user chose `user` or `project`, search that `CLAUDE.md` for a
section that names the style outside the `<!-- plane-english:output-style:begin -->` and `:end`
markers. The hook adds its own marked block, and uninstall removes only that block. Offer to delete
the hand-written section.

**A hand-installed copy.** Look for `plane-english.md` in `~/.claude/output-styles/`, and for a
`style-reminder` entry in the `hooks` block of `~/.claude/settings.json`. A copied style shows twice
in the picker. A copied hook sends each reminder twice, and an old copy can leak a warning into a
reply. Offer to remove both.

## Step 7: Switch the current session

The setting from Step 5 applies from the next session. Nothing switches the current session
automatically, so show this instruction word for word, on its own line:

> **Important:** run `/output-style plane-english:Plane English` to switch on now. Until you do this,
> none of its rules apply to the current session.

The command also works over Remote Control and headless. The `plane-english:` prefix is the `name`
in `plugin.json`, so do not add a marketplace suffix. On success, the reply is
`Output style set to plane-english:Plane English`. On Claude Code older than 2.1.269, run `/config`,
go to **Output style**, and select **Plane English**.

## Step 8: Confirm

Tell the user:

1. The values that you wrote, and each default that you took.
2. That the current session needs `/output-style plane-english:Plane English` (Step 7).
3. To change the values, run this skill again or edit `env` in `~/.claude/settings.json`.
4. Their own rules need no edit. The style wins on how a reply reads, and their rules keep authority
   over the work.
5. Only for a user who keeps the plugin: the optional `/plane-english:audit` proposes one edit per
   rule that contradicts the style, for approval. Fewer conflicts make replies cheaper.

Propose no edit to the user's rules, CLAUDE.md, or hooks, except a Step 6 duplicate. Then stop, with
no summary of the style.
