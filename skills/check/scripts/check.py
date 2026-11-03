#!/usr/bin/env python3
"""Check a markdown or text file against the Plane English language rules (ASD-STE100).

Exit 0 when clean, 1 when a finding exists. Exact spans are exempt by design:
fenced code, inline code, headings, table rows, and any line the caller exempts.
A URL is exempt only when it sits inside a markdown link (`[text](url)`) or a
code span; a bare URL or a bare `#123` issue/PR reference is a finding.
"""
import argparse
import re
import sys

# -ing words that are nouns or adjectives in normal technical prose, not verb forms.
ING_OK = {
    "during", "string", "thing", "nothing", "something", "anything", "everything",
    "morning", "evening", "ring", "spring", "king", "wing", "bring", "sing",
    "warning", "setting", "settings", "listing", "listings", "mapping", "mappings",
    "logging", "tracking", "handling", "heading", "headings", "meaning", "meanings",
    "building", "buildings", "reading", "readings", "finding", "findings",
    "training", "engineering", "marketing", "branching", "caching", "polling",
    "timing", "wording", "ceiling", "opening", "ending", "beginning",
    # participles used as adjectives in technical prose
    "existing", "missing", "remaining", "following", "matching", "pending",
    "leading", "trailing", "incoming", "outgoing", "ongoing", "upcoming",
}
MODALS = r"\b(should|would|may|might|could)\b"
PERFECT = r"\b(has|have|had)\s+(been|[a-z]+ed)\b"
# 's is a possessive far more often than a contraction, so only flag the pronoun cases.
CONTRACTION = (r"\b\w+n't\b|\b\w+'(re|ve|ll|m)\b"
               r"|\b(it|that|there|here|what|who|he|she|let)'s\b")
# Machine tells, phrases only. This set matches the phrases in section 2.8 of the style.
# A single slop word such as "leverage" belongs to the 2.4 word table, a read-through item.
SLOP = (r"\b(experts agree|studies show|many argue|widely regarded as"
        r"|stands? as a testament|marks? a pivotal|plays? a vital role"
        r"|underscores? (?:the|its)|what if I told you|think about it"
        r"|here is the thing|the part everyone misses)\b")


def strip_exact(text):
    """Blank out spans that no rule rewrites, so they raise no finding."""
    text = re.sub(r"`[^`]*`", lambda m: " " * len(m.group(0)), text)
    text = re.sub(r"https?://\S+", lambda m: " " * len(m.group(0)), text)
    return text


def strip_code(text):
    """Blank out only code spans, so a bare URL or issue number still shows."""
    return re.sub(r"`[^`]*`", lambda m: " " * len(m.group(0)), text)


def sentences(text):
    return [s for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


def check(lines, exempt_patterns, max_words):
    findings = []
    in_code = False
    # YAML frontmatter is router metadata, not prose. Skip it.
    start = 0
    if lines and lines[0].strip() == "---":
        for i, ln in enumerate(lines[1:], 2):
            if ln.strip() == "---":
                start = i
                break
    for n, raw in enumerate(lines, 1):
        if n <= start:
            continue
        line = raw.rstrip("\n")
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code or not line.strip():
            continue
        if line.lstrip().startswith(("#", "|", ">")):
            continue
        if any(re.search(p, line) for p in exempt_patterns):
            continue

        def add(rule, detail, text=None):
            snippet = text if text is not None else line.strip()
            findings.append((n, rule, detail, snippet[:100]))

        code_free = strip_code(line)
        for m in re.finditer(r"https?://\S+", code_free):
            if code_free[max(0, m.start() - 2):m.start()] != "](":
                add("unlinked reference", "wrap this URL in a markdown link: [PR #N](url)", m.group(0))
        link_free = re.sub(r"\[[^\]]*\]\([^)]*\)",
                            lambda m: " " * len(m.group(0)), code_free)
        for m in re.finditer(r"(?<![\w`])#\d+\b", link_free):
            add("bare issue/PR number", "write [#N](full URL), never a bare #N", m.group(0))

        prose = strip_exact(line)
        if "—" in prose or "–" in prose:
            add("em/en dash", "use a full stop or a comma")
        if ";" in prose:
            add("semicolon", "split into two sentences")
        for m in re.finditer(MODALS, prose, re.I):
            add("modal verb", m.group(0))
        for m in re.finditer(PERFECT, prose, re.I):
            add("present perfect", m.group(0))
        for m in re.finditer(CONTRACTION, prose):
            add("contraction", m.group(0))
        for m in re.finditer(SLOP, prose, re.I):
            add("machine tell", m.group(0) + " (2.8: give the fact, or delete)")
        for m in re.finditer(r"\b\w+ing\b", prose):
            if m.group(0).lower() not in ING_OK:
                add("-ing form", m.group(0) + " (noun or verb? verb forms are banned)")
        body = re.sub(r"[*_]{1,2}", "", prose)
        body = re.sub(r"^\s*(?:[-*+]|\d+\.)\s+", "", body)
        for s in sentences(body):
            words = len(s.split())
            if words > max_words:
                add("long sentence", f"{words} words, limit {max_words}", s.strip())
    return findings


def main():
    ap = argparse.ArgumentParser(description="Plane English language check")
    ap.add_argument("path")
    ap.add_argument("--exempt", action="append", default=[],
                    help="regex; a matching line raises no finding. Repeatable. "
                         "Use for text copied word for word from a template.")
    ap.add_argument("--max-words", type=int, default=25,
                    help="sentence limit; 25 for description text, 20 for instructions")
    a = ap.parse_args()

    with open(a.path, encoding="utf-8") as f:
        lines = f.readlines()
    findings = check(lines, a.exempt, a.max_words)

    for n, rule, detail, text in findings:
        print(f"{a.path}:{n}\t{rule}\t{detail}\t{text}")
    print(f"\n{len(findings)} finding(s) in {a.path}")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
