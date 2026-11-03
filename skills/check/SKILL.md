---
name: check
description: Fixes a draft against the Plane English language rules (ASD-STE100) and reports totals. A script finds countable faults (dashes, contractions, banned modals, long sentences), and a read-through finds the rest (passive voice, metaphor, hard words, filler). Targets a Software Engineer at English C1. Runs to completion with no approval step. Use before you post a GitHub issue or a pull request body, before you commit a README or a runbook, or before you send a report.
---

# Plane English check

The output style guards a chat reply. This skill fixes text that goes to disk or GitHub: an issue
body, a PR body, a README, or a report. It applies the language rules of Part 2 of the style, not the
structure rules of Part 1.

## Reader: Software Engineer, English C1

Ignore `PLANE_ENGLISH_TECH_LEVEL` and `PLANE_ENGLISH_ENGLISH_LEVEL` here. An artifact goes to readers
of unknown level, so the target is always C1, also for a `native` or a `B1` user.

## 1. Scan

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/check/scripts/check.py" /path/to/draft.md
```

The output has one line per finding: `path:line<TAB>rule<TAB>detail<TAB>text`. Use it as your
worklist, and do not show it to the user. The script only finds faults, so you make every edit.

## 2. Fix every finding

Edit the file, then run the script again. Repeat until it reports 0.

## 3. Read every sentence

The script cannot judge meaning. Read every sentence outside the exempt spans for these faults:

- **Passive voice.** Name the actor. Look for "was done by", "is handled", "gets called".
- **Metaphor and idiom.** A reader takes a word picture literally. Write the plain fact.
- **Vocabulary above C1.** Use the plainer word with the same meaning: `use` over `utilize`, `start`
  over `commence`, `about` over `regarding`. Keep audience terms and exact names.
- **Filler.** "As mentioned above", "in order to", "please note that". Delete it.
- **An unclear referent.** "This breaks it" tells a new reader nothing. Name the thing.
- **A machine tell that no regex finds (style 2.8).** A binary contrast ("it is not X, it is Y"), a
  colon reveal ("the best part: it learns"), metadiscourse ("the key point is"), fragment drama, or a
  final flourish. A sentence that fits another company unchanged is filler (the portability test).

Two limits apply to every edit:

- **Keep every fact.** If a rule costs a number, a path, or a caveat, split the sentence instead.
- **Do not edit an exact span:** code, commands, file paths, quoted errors and log lines, product
  names, config keys, and button labels.

Then run the script again, because a rewrite can add new faults.

## 4. Report totals only

Give the file, the total of fixes, and a count per rule for both passes in one list. Do not list
single findings, quote before and after, or ask for approval.

```
draft.md, 19 fixes: 6 long sentences, 3 em dashes, 2 contractions,
2 "-ing" forms, 1 present perfect, 3 passive, 1 metaphor, 1 filler.
Clean on re-run.
```

If the read-through finds nothing, write `0 semantic`, so the user sees that it ran. In one line, name
each fault that you left and why.

## Text copied word for word

The script cannot tell your prose from a quotation, such as an issue-template label. Exempt those
lines instead of a rewrite:

```bash
python3 .../check.py /tmp/issue.md \
  --exempt '^- \[x\]' \
  --exempt 'What.s Wrong'
```

Fenced code, inline code, URLs, headings, table rows, quote lines, and YAML frontmatter are already
exempt. Do not use `--exempt` to hide your own prose.
