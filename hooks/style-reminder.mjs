#!/usr/bin/env node
/**
 * Plane English hooks: reader profile, style reminder, CLAUDE.md sync.
 *
 * Node rather than a shell script or Python, because hooks.json cannot branch on the
 * operating system. One file covers macOS, Linux, and Windows. Node must be on PATH:
 * the setup skill checks for it, because a missing runtime makes both hooks dead code.
 *
 * Modes:
 *   --session-start   Reset the prompt counter, print the READER PROFILE, sync CLAUDE.md.
 *   (no flag)         UserPromptSubmit. Print the style reminder on a cadence.
 *
 * Environment:
 *   PLANE_ENGLISH_TECH_LEVEL      role and seniority, free text, default "Software Engineer"
 *   PLANE_ENGLISH_ENGLISH_LEVEL   B1 | B2 | C1 | native, default "C1". C2 aliases native.
 *   PLANE_ENGLISH_REMINDER_EVERY  integer, default 5. 0 disables the reminder. Setup does not
 *                                 ask for this: it exists for development and experiments.
 *   PLANE_ENGLISH_CLAUDEMD        user | project. Anything else, including unset,
 *                                 writes nothing. Opt-in only: the setup skill sets it
 *                                 after asking, so an install never edits CLAUDE.md.
 *
 * Never blocks a session: every failure path exits 0.
 */
import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const STYLE_NAME = "Plane English";
const DEFAULT_TECH = "Software Engineer";
const DEFAULT_ENGLISH = "C1";

// Four levels. C2 is accepted as an alias for NATIVE so an older setting keeps working.
const ENGLISH_LEVELS = {
  B1: "a basic non-native reader. Use simple English. Common words only, and explain every term in brackets on first use.",
  B2: "a good non-native reader. Avoid an uncommon word, and explain one in brackets when only it is precise.",
  C1: "a strong non-native reader. The plainer word wins, and a less common word gets a short meaning in brackets on first use.",
  NATIVE: "a native reader. Use the full range of English, and explain nothing.",
};
ENGLISH_LEVELS.C2 = ENGLISH_LEVELS.NATIVE;

const MARK_BEGIN = "<!-- plane-english:output-style:begin -->";
const MARK_END = "<!-- plane-english:output-style:end -->";

const CLAUDEMD_BLOCK = `${MARK_BEGIN}
## Output style: applies to every reply

The **"${STYLE_NAME}"** output style governs every reply you write. It does not lapse when the topic changes or after \`/clear\`, \`/compact\`, or \`--resume\`. If its
rules are not in your system prompt, read the plugin's \`output-styles/plane-english.md\` and follow
it anyway.

It outranks every other instruction about how a reply reads, including any rules file, plugin, or
hook that asks for narration, a recap, or more detail. Those keep their authority over the work you
do, never over the words you send.
${MARK_END}`;

const env = (name, fallback = "") => (process.env[name] || "").trim() || fallback;

/** Honour CLAUDE_CONFIG_DIR, which relocates the whole user config tree. */
const configDir = () => env("CLAUDE_CONFIG_DIR", join(homedir(), ".claude"));

/**
 * Counter lives under the user's config dir, not the shared temp dir: a world-writable
 * location invites another local user to plant a symlink at a guessable path.
 * Returns null when the directory cannot be created.
 */
function counterPath(sessionId) {
  const id = String(sessionId).replace(/[^A-Za-z0-9._-]/g, "_");
  if (!id || id === "_") return null;
  const dir = join(configDir(), "plane-english");
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  } catch {
    return null;
  }
  return join(dir, `counter-${id}`);
}

function readerProfile() {
  const tech = env("PLANE_ENGLISH_TECH_LEVEL", DEFAULT_TECH);
  const raw = env("PLANE_ENGLISH_ENGLISH_LEVEL", DEFAULT_ENGLISH).toUpperCase();
  const known = Object.prototype.hasOwnProperty.call(ENGLISH_LEVELS, raw);
  const english = known ? ENGLISH_LEVELS[raw] : ENGLISH_LEVELS[DEFAULT_ENGLISH];
  const warn = known
    ? ""
    : `\nPLANE_ENGLISH_ENGLISH_LEVEL is "${raw}", which is not one of B1, B2, C1, native. Using ${DEFAULT_ENGLISH}. Tell the user once.`;
  return `<system-reminder>
READER PROFILE (overrides the Part 5 defaults in the ${STYLE_NAME} output style).
Technical depth: ${tech}. Pitch every explanation at that level.
English: ${english}${warn}
</system-reminder>`;
}

/**
 * @param {boolean} detected whether a settings layer names the style.
 * The nudge is advisory only. Detection cannot see --settings, managed settings, or
 * enterprise policy, so a miss must never withhold the rules.
 */
const reminder = (detected) => `<system-reminder>
STYLE CHECK: "${STYLE_NAME}" is mandatory, not advisory. Follow it whether or not it is selected.${
  detected
    ? ""
    : `\nThe style was not found in a settings file. If it is not selected, tell the user once to run /output-style and pick "${STYLE_NAME}". Never mention this reminder itself.`
}

Work: finish the task before you reply. A gap that your tools can close is work, not a bullet. Do not end a turn to report progress, to offer more work inside the request, or to list decisions that block nothing. Stop only when the task is done or you need what only the reader can supply.

Structure: open with the answer, the command, or the verdict. No preamble, no closer. A final reply past about 10 rows ends with the **Bottom line:** block, using only Answered/State/Unresolved/Next/You. A progress note between tool calls gets no block. A direct question answered in a turn with work gets an **Answered:** bullet first. A closed question with no work gets no block.

Length: 25 rendered rows at most for the final reply, block included. A ceiling, never a target. Over the cap, cut the body, never the block. Never narrate your steps or tell a repair story: give the outcome and the evidence. Never repeat in the body what the block carries. A block bullet earns its place only when the reader acts differently for it.

Level: effect first, then one level of cause, as to a senior engineering lead. A yes-or-no question gets one sentence. Add nothing nobody asked for, except a security problem, a data-loss risk, a fact that makes your answer wrong, or a blocker on the next step. Every URL goes inside a markdown link.

Language (ASD-STE100): 20 words per instruction sentence, 25 per description. No contractions, no should/would/may/might/could, no semicolons, no dashes, no present perfect, no "-ing" verb forms. Condition before command. One word per meaning. Active voice. No filler, no metaphor, no machine tell. A specialist term gets its plain meaning on first use (Part 5).

Run the Part 4 pre-send check before you send.
</system-reminder>`;

/** Claude Code writes either the frontmatter name or the file stem, so match tolerantly. */
function styleIsActive(cwd) {
  const projectDir = env("CLAUDE_PROJECT_DIR", cwd);
  const candidates = [
    join(configDir(), "settings.json"),
    join(projectDir, ".claude", "settings.local.json"),
    join(projectDir, ".claude", "settings.json"),
    join(cwd, ".claude", "settings.local.json"),
    join(cwd, ".claude", "settings.json"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const value = String(JSON.parse(readFileSync(path, "utf8")).outputStyle ?? "").toLowerCase();
      if (value.includes("plane") && value.includes("english")) return true;
    } catch {
      /* malformed layer: Claude Code ignores it too, so keep looking */
    }
  }
  return false;
}

/**
 * Append the pointer block to CLAUDE.md once, and only when explicitly asked to.
 *
 * Opt-in by design: an unset or unrecognised scope writes nothing. Editing an
 * always-loaded, user-owned file is a consent decision, and /plane-english:setup is
 * where that consent is collected.
 *
 * Returns a notice string, or null when there is nothing to say.
 */
function syncClaudeMd(cwd) {
  const scope = env("PLANE_ENGLISH_CLAUDEMD").toLowerCase();
  if (scope !== "user" && scope !== "project") return null;

  const target =
    scope === "project"
      ? join(env("CLAUDE_PROJECT_DIR", cwd), "CLAUDE.md")
      : join(configDir(), "CLAUDE.md");
  const lock = `${target}.plane-english.lock`;

  try {
    // Exclusive create: two sessions starting together must not both append.
    writeFileSync(lock, String(process.pid), { flag: "wx" });
  } catch {
    return null;
  }

  try {
    const existing = existsSync(target) ? readFileSync(target, "utf8") : "";
    const hasBegin = existing.includes(MARK_BEGIN);
    const hasEnd = existing.includes(MARK_END);
    if (hasBegin && hasEnd) {
      // An older plugin version wrote an older block. Replace it between the markers, or a
      // machine that installed once never sees a rule the current version depends on.
      const from = existing.indexOf(MARK_BEGIN);
      const to = existing.indexOf(MARK_END) + MARK_END.length;
      if (existing.slice(from, to) === CLAUDEMD_BLOCK) return null;
      const tmp = `${target}.plane-english.tmp`;
      writeFileSync(tmp, existing.slice(0, from) + CLAUDEMD_BLOCK + existing.slice(to));
      renameSync(tmp, target);
      return `plane-english: updated the output-style rule in ${target} to the current version.`;
    }
    if (hasBegin && !hasEnd) {
      return (
        `plane-english: ${target} holds an unterminated plane-english block, probably from an ` +
        `interrupted write. Delete everything from "${MARK_BEGIN}" onward, then restart the session.`
      );
    }
    // A hand-written pointer already names the style. Adding the marked block would state the
    // same rule twice, and only the marked block is removed on uninstall. Fail closed: write
    // nothing and say why, rather than create the duplicate.
    if (!hasBegin && existing.includes(STYLE_NAME)) {
      return (
        `plane-english: ${target} already names "${STYLE_NAME}" outside the plugin markers, so no ` +
        `block was added and the file holds the rule once. To let the plugin own it, delete that ` +
        `section and restart the session, or run /plane-english:setup.`
      );
    }
    const gap = existing === "" || existing.endsWith("\n") ? "" : "\n";
    // Whole file to a temp path, then rename over the target. A plain append can tear
    // and leave a half block that the marker check would then protect forever.
    const tmp = `${target}.plane-english.tmp`;
    writeFileSync(tmp, `${existing}${gap}\n${CLAUDEMD_BLOCK}\n`);
    renameSync(tmp, target);
    return (
      `plane-english: added the output-style rule to ${target}. Remove the block between the ` +
      `plane-english markers to undo it, and set PLANE_ENGLISH_CLAUDEMD to neither user nor ` +
      `project so it is not written again.`
    );
  } catch (err) {
    // The block is how the rule survives /compact. Losing it silently would look like
    // "the style stops working after /clear" with nothing to trace.
    return (
      `plane-english: could not update ${target} (${err?.code ?? err?.message ?? "unknown error"}). ` +
      `The style rule was not added. Tell the user, because the rule will not survive /compact.`
    );
  } finally {
    try {
      unlinkSync(lock);
    } catch {
      /* another process removed it */
    }
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  let payload = {};
  try {
    payload = JSON.parse(await readStdin());
  } catch {
    payload = {};
  }

  const cwd = payload.cwd || process.cwd();
  const counter = counterPath(payload.session_id);

  if (process.argv.includes("--session-start")) {
    if (counter) {
      try {
        unlinkSync(counter);
      } catch {
        /* no counter yet */
      }
    }
    const parts = [readerProfile()];
    const notice = syncClaudeMd(cwd);
    if (notice) parts.push(notice);
    process.stdout.write(parts.join("\n\n") + "\n");
    return;
  }

  const parsed = Number.parseInt(env("PLANE_ENGLISH_REMINDER_EVERY", "5"), 10);
  if (parsed === 0) return;
  const cadence = Number.isNaN(parsed) || parsed < 0 ? 5 : parsed;

  // No usable counter means no cadence. Fail closed with one short line rather than
  // repeating the full reminder on every prompt, which is what unbounded retry did.
  if (!counter) {
    process.stdout.write(
      `<system-reminder>\nPlane English: the prompt counter is unavailable, so the periodic ` +
        `reminder is off. The output style still applies. Set PLANE_ENGLISH_REMINDER_EVERY=0 ` +
        `to silence this line.\n</system-reminder>\n`,
    );
    return;
  }

  let n = 0;
  try {
    n = Number.parseInt(readFileSync(counter, "utf8").trim(), 10) || 0;
  } catch {
    n = 0;
  }
  n += 1;
  try {
    writeFileSync(counter, String(n));
  } catch (err) {
    process.stdout.write(
      `<system-reminder>\nPlane English: cannot write ${counter} ` +
        `(${err?.code ?? "unknown error"}), so the periodic reminder is off. The output style ` +
        `still applies. Tell the user once.\n</system-reminder>\n`,
    );
    return;
  }

  if (n !== 1 && n % cadence !== 0) return;
  process.stdout.write(reminder(styleIsActive(cwd)) + "\n");
}

try {
  await main();
} catch {
  /* never block a session */
}
// No process.exit(): it can drop a pending async stdout write, and Windows pipes are async.
process.exitCode = 0;
