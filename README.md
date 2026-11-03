# Plane English

Plane English is a Claude Code plugin that makes Claude's replies short and plain. The answer comes first, and a long reply ends with a `Bottom line:` block that you can find again. Every sentence follows [ASD-STE100](https://asd-ste100.org), the controlled English of aerospace maintenance manuals.

It is for developers who read many Claude Code replies a day, and for readers whose first language is not English. It runs locally inside Claude Code and needs no API key.

## Example

The same two prompts, sent to **Claude Opus 5.5** (`claude-opus-5-5`) in the same small repository with the same tools. One run has no output style and no personal settings. The other adds this plugin, with the default reader profile: `Software Engineer`, English level `C1`. Both runs did the same work and left the suite at 5 passed, 0 failed.

The replies are complete and word for word. The only changes are for the page: no markdown markers, and the text wraps at 84 columns.

### Turn 1: the task

> **Prompt:** Money is held as float in `cart.py`, which is wrong for currency. Migrate the module to `decimal.Decimal` end to end, update `run_tests.py` so the expected values are Decimal too, and prove the suite passes. Add a test that would fail under float arithmetic but passes under Decimal.

#### Without Plane English, 306 words

```
cart.py now uses Decimal throughout, and the suite passes: 5 passed, 0 failed, exit
0. I haven't committed anything.

A bug I fixed along the way. Before I changed anything, the suite was already
failing: ten_pct expected 21.6 but got 22.0. The old code took the discount off the
pre-tax subtotal but still charged tax on the full, undiscounted subtotal. The test
was right and the code was wrong. Applying the discount and the tax in either order
gives 20 × 0.9 × 1.2 = 21.6. cart_total now discounts first using the existing
apply_discount helper, which nothing was calling before, then adds tax. Any cart
with a discount will now total less than it used to.

cart.py
- TAX_RATE is Decimal("0.2"). All the arithmetic is done in Decimal, and the total
  is rounded to the cent only once, at the very end.
- Rounding is now half-up (0.675 becomes 0.68), the usual rule for currency.
  Python's round() uses banker's rounding, so results on exact half-cents can differ
  from before.
- A new to_money() function accepts Decimal, int or str and raises TypeError for
  floats. A float has already lost precision (Decimal(0.1) is not Decimal("0.1")),
  so letting one in quietly would undo the migration. Any caller still passing
  floats will now get an error and needs to change.
- cart_total returns a Decimal, e.g. Decimal('21.60').

run_tests.py
- All prices and expected values are Decimal, and the check also confirms the
  returned type, so a float result counts as a failure.
- New half_cent_boundary test: $0.75 at 25% off is exactly 0.675, which should round
  to 0.68. In float the same sum comes out as 0.67499999…, which rounds to 0.67. I
  ran that float calculation directly and it fails the test, so the test does catch
  float arithmetic.
- New rejects_float test confirms a float price raises TypeError.
```

#### With Plane English, 260 words

```
The suite passes: python3 run_tests.py shows 5 passed, 0 failed, exit 0. cart.py now
uses Decimal for every money value.

Changes in cart.py:
- TAX_RATE is Decimal("0.2"). The total rounds to cents with quantize and
  ROUND_HALF_UP, not with round().
- A float input raises TypeError. Callers must pass Decimal, int, or str.
- Discount fix: the old code took the discount from the pre-tax subtotal and
  subtracted it from the taxed total. As a result, ten_pct already failed before the
  migration (got 22.0, wanted 21.6). cart_total now calls apply_discount on the
  taxed total, which gives 21.60.

The float-failure test is half_cent_float_fails: price 0.55, discount 25%. The exact
total is 0.495 and rounds to 0.50. As a float, the value is 0.49499999999999999555…,
so round() gives 0.49. I ran the float formula and got 0.49. The case gives 0.50
with both ROUND_HALF_UP and ROUND_HALF_EVEN, so the test does not depend on the
rounding mode.

run_tests.py: all expected values are Decimal. A case also passes only when the
result type matches, so a float result fails even when the value is equal. A fifth
case, float_input_rejected, makes sure that a float input raises TypeError.

Bottom line: cart.py uses Decimal end to end, and all 5 tests pass, including one
that fails under float. Nothing is committed.

- Unresolved: Two changes affect existing callers. A float input now raises
  TypeError. A discounted total is now lower, because the discount also applies to
  the tax (22.00 becomes 21.60).
- You: Confirm both behavior changes. If you want, I can accept floats with a
  Decimal(str(x)) conversion.
```

Both runs found the same bug that existed before the change, and both changed the behavior for existing callers. The unstyled reply mentions those changes inside two paragraphs. The styled reply puts both of them on `Unresolved:` and asks for a decision on `You:`, at the bottom where you see them first.

### Turn 2: a follow-up question

> **Prompt:** Do I need to change the database column type as well?

#### Without Plane English, 301 words

```
Nothing in this repo uses a database. It's just cart.py and run_tests.py, with no
schema, ORM or SQL, so I can't see what your column is. Whether you need to change
it depends on its current type:

- FLOAT, REAL or DOUBLE PRECISION: yes, change it. These store binary floating
  point, so the rounding errors come back as soon as a value is saved and read
  again. Switch to NUMERIC(12, 2) (also called DECIMAL; it's the same type in
  Postgres and MySQL). Pick the precision for your largest amount. Use more decimal
  places, like NUMERIC(12, 4), if you store unit prices or rates finer than a cent.
- NUMERIC/DECIMAL already: no schema change needed. Most Python drivers already
  return these as Decimal (psycopg, mysqlclient, SQLAlchemy's Numeric). Check that
  your driver or ORM isn't set to convert them to float. For example, SQLAlchemy
  Numeric(asdecimal=False) returns floats.
- Integer cents (BIGINT): no change needed. That's also a valid way to store money.
  Convert at the edge with Decimal(cents) / 100 when reading and int(amount * 100)
  when writing. Since cart_total already rounds to the cent, that conversion is
  exact.
- SQLite: it has no true decimal type, and NUMERIC columns can quietly store values
  as floating point. Store integer cents or text strings instead.

If you do migrate a float column, existing rows already contain the float error.
Round them during the migration, e.g. ALTER COLUMN price TYPE NUMERIC(12,2) USING
ROUND(price::numeric, 2) in Postgres. Then spot-check some totals against the old
values.

Also, cart.py now raises TypeError for float inputs, so any code that reads float
values from the database and passes them to cart_total will fail loudly rather than
silently losing precision. If you point me at the code that touches the database, I
can check the column types and driver settings.
```

#### With Plane English, 59 words

```
Yes, if the column is FLOAT, REAL, or DOUBLE. These types store binary floats, so
each value gets the same rounding error again before it reaches Decimal. Change the
column to NUMERIC(12, 2) or DECIMAL(12, 2), or store integer cents in an INTEGER
column. This repository has no database code or schema, so I cannot see your column
type.
```

The repository has no database. Both replies say so, but the unstyled reply then writes four cases and a migration for a schema that it cannot see. The styled reply answers the question in the first word and stops.

### A longer task: finish the work

Version 0.8.0 adds a rule that Claude finishes the work before it replies. We gave Opus 5.5 one prompt with eight tasks for a small inventory module, once with version 0.7.2 and once with 0.8.0. Both finished all eight tasks, and the tests passed. This is one run of each version, not a benchmark.

- **0.7.2** found that the new CLI prints an empty report, because the stock lives only in memory. It left this gap open, and asked the reader to choose a fix and to confirm three decisions that blocked nothing.
- **0.8.0** found the same gap and closed it: it added a `--file` option that loads the stock from a JSON file. It reported its decisions as facts, and asked only whether to commit.

## What it does

**Structure.** The answer comes first. A reply past about ten rows ends with a block like this one:

```
Bottom line: cart.py uses Decimal end to end, and all 5 tests pass. Nothing is
committed.

- Unresolved: a float input now raises TypeError.
- You: confirm this behavior change.
```

The block uses five labels and no others: `Answered:`, `State:`, `Unresolved:`, `Next:`, and `You:`. A label with nothing useful to say is left out. A reply has a hard limit of 25 rows, and it never narrates the steps that Claude took.

**Language.** All prose follows ASD-STE100 Simplified Technical English. Sentences are short, with one word for each meaning, simple tenses, and active voice. A condition comes before its command, and there is no filler, metaphor, or em dash. The style also bans ten patterns that mark text as machine-written, such as "it is not X, it is Y".

**Work.** The style limits the words of a reply, never the work. Claude does every step that the task needs before it replies. A gap that its tools can close is work to do, not a bullet in the block. `You:` holds only what you alone can supply: a credential, a decision with no reasonable default, or approval for a push, a deploy, or a deletion.

The full rule set is in [output-styles/plane-english.md](output-styles/plane-english.md).

## Where the rules apply

| What Claude writes | Structure | Language |
|---|---|---|
| A reply to you: answer, explanation, review, plan | Yes | Yes |
| A commit message | No, the repository convention wins | Yes |
| A PR body, an issue body, a comment on either | No, the repository template wins | Yes |
| A file on disk: README, runbook, design doc, report | No, the form of the document wins | Yes |
| Code and code comments | No | No, the codebase style wins |
| Marketing or brand copy | No | No, the rules remove persuasion |

No rule changes exact text: code, commands, file paths, quoted errors, log lines, and names such as a config key or a button label.

## Install

Requirements: Claude Code, and `node` on `PATH` for the two hooks. The style itself works without Node.

```
/plugin marketplace add danielmjrr/plane-english
/plugin install plane-english@plane-english
/plane-english:setup
```

Then switch the style on. Setup does not do this step for you:

```
/output-style plane-english:Plane English
```

Until you run this command, the current session does not use the rules. In Claude Code older than 2.1.269, use `/config`, then **Output style**.

## Skills

**`/plane-english:check`** fixes a draft before you post it: an issue body, a PR body, a README, or a report. A script finds the countable faults, such as em dashes, semicolons, contractions, banned modal verbs, and long sentences. Claude then reads each sentence for the faults that need judgment, such as passive voice, metaphor, and hard words. The target reader is a Software Engineer with C1 English, whatever your own settings are.

```
/plane-english:check the draft in /tmp/issue.md
```

**`/plane-english:audit`** finds rules in your own `CLAUDE.md` files, rules files, memory files, agents, and skills that conflict with the style. It backs up each file first, proposes one small edit for each conflict, and changes only the edits that you approve by number. It never edits a plugin or a hook. `/plane-english:audit --report` lists the conflicts and changes nothing.

You do not have to run the audit. The style states that it wins on how a reply reads, and your rules keep their authority over the work. The audit removes the conflict, so Claude does not have to decide between two rules on each turn.

## How it stays on

An output style is part of the system prompt, so it stays on after `/clear`, `/compact`, and `--resume`. Two hooks keep Claude on the rules in a long session:

- **`SessionStart`** adds your reader profile, and resets the reminder counter.
- **`UserPromptSubmit`** repeats a short form of the rules on the first prompt, then on every fifth prompt.

## Configuration

`/plane-english:setup` sets these values under `env` in `~/.claude/settings.json`. You can also edit them by hand.

- **`PLANE_ENGLISH_TECH_LEVEL`**, default `Software Engineer`: your role and seniority, as free text, such as `Senior Backend Engineer` or `QA Engineer`. Claude writes each explanation for this level.
- **`PLANE_ENGLISH_ENGLISH_LEVEL`**, default `C1`. `B1` gives simple English, and `B2` avoids uncommon words. `C1` takes the plainer word and explains a rare one. `native` uses the full range, and `C2` is the same as `native`.
- **`PLANE_ENGLISH_CLAUDEMD`**, not set by default: `user` adds a short pointer to the style in `~/.claude/CLAUDE.md`, and `project` adds it to the project `CLAUDE.md`. With no value, the plugin writes nothing.

```json
{
  "env": {
    "PLANE_ENGLISH_TECH_LEVEL": "Senior Backend Engineer",
    "PLANE_ENGLISH_ENGLISH_LEVEL": "native"
  }
}
```

## Uninstall

```
/plugin uninstall plane-english@plane-english
```

Then remove three things that the plugin cannot remove for you:

1. Run `/output-style` and pick another style, or delete `outputStyle` from `~/.claude/settings.json`.
2. Delete the block between the `<!-- plane-english:... -->` markers in your `CLAUDE.md`, if setup added one.
3. Delete the `PLANE_ENGLISH_*` keys from `env` in `~/.claude/settings.json`.

## Credits

Plane English combines three MIT-licensed projects. Thanks to their authors:

- [SimpleClaude](https://github.com/kylesnowschwartz/SimpleClaude) by Kyle Snow Schwartz, for the `bottom-line` output style.
- [SimpleEnglish](https://github.com/AminBlg/SimpleEnglish) by AminBlg, for the ASD-STE100 ruleset.
- [no-ai-slop](https://github.com/petergyang/no-ai-slop) by Peter Yang, for the machine-tell patterns.

ASD-STE100 is a specification of the AeroSpace and Defence Industries Association of Europe (ASD). The official dictionary is a free download at [asd-ste100.org](https://asd-ste100.org). No tool can guarantee full compliance with the standard.

MIT license. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
