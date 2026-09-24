#!/usr/bin/env python3
"""Harvest receipts for a day-in-my-life film from the user's own Claude Code history. Local only.

    python3 scripts/harvest.py --out <film-dir>/receipts.json [--root ~/.claude/projects] [--tz Area/City] [--project SUBSTR]

Reads (never writes, never uploads):
  <root>/*/*.jsonl          top-level session transcripts (subagent sidechains are skipped): the user's messages, and
                            the agent's own tool calls (to find the user's routine: reading, editing, tests, commits)
  <root>/*/memory/*.md      memory files (frontmatter `name:` / `type:`), if the user keeps them
  CLAUDE.md                 of each project folder the transcripts point at, if it exists
Writes one JSON file (--out) with candidate receipts, verbatim, each with a timestamp, a session id and privacy flags.
That file holds the user's own words: keep it inside the film folder, never commit or share it.
Python 3.9+ standard library only.
"""
import argparse, collections, datetime as dt, glob, json, os, re, statistics

ap = argparse.ArgumentParser()
ap.add_argument('--root', default=os.path.expanduser('~/.claude/projects'))
ap.add_argument('--out', required=True)
ap.add_argument('--tz', default=None, help='IANA zone for day/time picks (default: this machine\'s zone)')
ap.add_argument('--project', default=None, help='only transcripts whose project folder contains this substring')
ap.add_argument('--keep-current', action='store_true', help='include transcripts written in the last 30 minutes (normally skipped: that is this session)')
a = ap.parse_args()

if a.tz:
    from zoneinfo import ZoneInfo
    TZ = ZoneInfo(a.tz)
else:
    TZ = dt.datetime.now().astimezone().tzinfo

SKIP = re.compile(r'^(<|\[Request interrupted|Caveat:|This session is being continued|\[Image|\[Pasted)')
PASTED = re.compile(r'^\s*([-*>#|]|\d+\.\s|//|```)|[{};]\s*$|=>|\bconst |\bdef |\bfunction\b')   # bullets, quotes, code: not the user talking
CATS = {   # chapter type → pattern over the lowercased message (+ max length for short quotable lines)
    'building':     (re.compile(r"^(ok(ay)?|yes|yep|sure|sounds good|go( ahead)?( please)?|do it|ship it|let'?s (do it|go)|proceed|continue|go for it)\b"), 70),
    'restart':      (re.compile(r'\b(restart|reboot|pause|brb|be right back|stepping away|one sec|hold on|back in a)\b'), 90),
    'knock':        (re.compile(r"^(how goes|how'?s it going|how is it going|status\??$|any update|how are we doing|where are we|how'?s (it|that) (looking|coming)|progress\?)"), 50),
    'notes':        (re.compile(r"\b(too (slow|fast|big|small|much)|not right|still not|isn'?t right|wrong|missing|worse|looks off|should be|needs to|doesn'?t (look|feel)|far off)\b"), 80),
    'side-by-side': (re.compile(r'\b(so close|super close|super duper close|almost there|nearly there|very close|getting close|closer)\b'), 80),
    'good-part':    (re.compile(r"\b(perfect|love (it|this|these|that)|amazing|awesome|beautiful|great job|nailed it|thank you|thanks|incredible|so good|youre? (the best|beautiful))\b"), 80),
    'frames':       (re.compile(r'\b(\d{2,3} ?fps|frame by frame|every frame|frame rate|per frame)\b'), 120),
    'watching':     (re.compile(r'(youtube\.com|youtu\.be|instagram\.com|tiktok\.com|x\.com/|twitter\.com|vimeo\.com)|\bmute(d)?\b'), 200),
    'kept':         (re.compile(r'\b(remember (this|that)|from now on|next time|improve the chances|make a note|note that|always|never again|lesson)\b'), 160),
}
# What the agent did, from its own tool calls: the user's routine, whatever their work is.
ACTS = [   # (activity, tool names, Bash command pattern)
    ('read',    {'Read', 'Grep', 'Glob', 'LS', 'NotebookRead'}, None),
    ('edit',    {'Edit', 'Write', 'MultiEdit', 'NotebookEdit'}, None),
    ('test',    set(), re.compile(r'\b(pytest|jest|vitest|mocha|rspec|phpunit|unittest|go test|cargo test|(npm|yarn|pnpm|bun)( run)? test|make test|playwright test|tox)\b')),
    ('build',   set(), re.compile(r'\b((npm|yarn|pnpm|bun) run build|tsc\b|cargo build|go build|gradle|mvn |make\b|webpack|vite build|next build|xcodebuild)')),
    ('run',     set(), re.compile(r'\b((npm|yarn|pnpm|bun) (run )?(dev|start)|uvicorn|flask run|rails s|docker compose up|python3? [\w./-]+\.py|node [\w./-]+\.m?js)')),
    ('install', set(), re.compile(r'\b((npm|pnpm|bun) (i|install|ci|add)|yarn add|pip3? install|brew install|cargo add|go get|poetry add|uv add)\b')),
    ('commit',  set(), re.compile(r'\bgit (commit|push)\b')),
    ('pr',      set(), re.compile(r'\bgh pr (create|merge)\b')),
    ('deploy',  set(), re.compile(r'\b(deploy|vercel|netlify|fly deploy|kubectl apply|terraform apply|serverless|wrangler)\b')),
    ('data',    set(), re.compile(r'\b(psql|sqlite3|mysql|bq query|duckdb|snowsql)\b')),
    ('render',  set(), re.compile(r'\b(hyperframes (render|preview|snapshot)|ffmpeg|remotion)\b')),
    ('web',     {'WebFetch', 'WebSearch'}, re.compile(r'\bcurl\b')),
    ('delegate', {'Task', 'Agent'}, None),
]
FAIL = re.compile(r'(\b\d+ (failed|failing)\b|\bFAIL(ED)?\b|\bTraceback\b|\bError:|✗|✕|\bERR!)')
PASS = re.compile(r'(\b\d+ (passed|passing)\b|\bPASS\b|\bOK\b|✓|\ball tests? passed\b)', re.I)
def bash_heads(cmd):
    """The commands actually run: first line only (no heredoc bodies), split on && || ; |, minus cd/export/VAR= prefixes."""
    heads = []
    for seg in re.split(r'&&|\|\||;|\|', (cmd or '').split('\n')[0]):
        toks = seg.strip().split()
        while toks and (toks[0] in ('cd', 'export', 'env', 'time', 'sudo') or re.match(r'^\w+=', toks[0])):
            toks = toks[2:] if toks[0] in ('cd', 'export') else toks[1:]
        if toks: heads.append(' '.join(toks[:6]))
    return heads
def classify(name, inp):
    for act, tools, rx in ACTS:
        if name in tools: return act, None
        if name == 'Bash' and rx:
            for h in bash_heads(inp.get('command')):
                if rx.match(h) or rx.match(re.sub(r'^(npx|bunx|uvx|python3? -m)( -y| --yes)? ', '', h)): return act, h
    return None, None
COMMIT_MSG = re.compile(r'''git commit[^\n]*?-m\s+(?:"([^"]{3,90})"|'([^']{3,90})')''')
PR_TITLE = re.compile(r'''gh pr create[^\n]*?--title\s+(?:"([^"]{3,90})"|'([^']{3,90})')''')

GREETING = re.compile(r'^(hi|hey|hello|hiya|good (morning|afternoon|evening)|morning|yo)\b', re.I)
FLAGS = {
    'secret': re.compile(r'\b(sk-[\w-]{8,}|sk_[A-Za-z0-9]{8,}|ghp_\w{8,}|github_pat_|xox[abpr]-|AKIA[0-9A-Z]{12,})|-----BEGIN'),
    'email': re.compile(r'[\w.+-]+@[\w-]+\.[\w.]+'),
    'path': re.compile(r'(^|\s|@")(/Users/|/home/|~/|[A-Z]:\\)'),
    'url': re.compile(r'https?://\S+|\b[\w-]+\.(com|io|dev|ai|app|net|org|co)/\S*', re.I),
}
NAME = re.compile(r'(?<![.!?]\s)(?<!^)\b([A-Z][a-z]{2,})\b')   # capitalised word mid-sentence: maybe a person

def flags(t):
    f = [k for k, r in FLAGS.items() if r.search(t) and k != 'url']
    doms = sorted({m.group(1).lower() for m in re.finditer(r'(?:https?://)?(?:www\.)?([\w-]+(?:\.[\w-]+)*\.(?:com|io|dev|ai|app|net|org|co|sh|so|xyz|me))\b', t, re.I)})
    if doms: f.append('url:' + ','.join(doms[:4]))
    names = [w for w in NAME.findall(t) if w.lower() not in {'claude', 'the', 'this', 'that', 'okay', 'ok', 'can', 'i'}]
    if names: f.append('name?:' + ','.join(sorted(set(names))[:4]))
    return f

def texts(content):
    if isinstance(content, str): return content
    if isinstance(content, list):
        if any(isinstance(x, dict) and x.get('type') == 'tool_result' for x in content): return ''
        return ' '.join(x.get('text', '') for x in content if isinstance(x, dict) and x.get('type') == 'text')
    return ''

sessions = []
now = dt.datetime.now().timestamp()
for f in sorted(glob.glob(os.path.join(a.root, '*', '*.jsonl'))):
    proj = os.path.basename(os.path.dirname(f))
    if a.project and a.project not in proj: continue
    if not a.keep_current and now - os.path.getmtime(f) < 1800: continue   # the session making this film
    msgs, acts, results, cwd = [], [], {}, None
    with open(f, errors='ignore') as fh:
        for line in fh:
            try: d = json.loads(line)
            except ValueError: continue
            cwd = cwd or d.get('cwd')
            if d.get('isSidechain') or not d.get('timestamp'): continue
            ts = dt.datetime.fromisoformat(d['timestamp'].replace('Z', '+00:00')).astimezone(TZ)
            content = d.get('message', {}).get('content')
            if d.get('type') == 'assistant' and isinstance(content, list):
                for c in content:
                    if isinstance(c, dict) and c.get('type') == 'tool_use':
                        inp = c.get('input') or {}; act, head = classify(c.get('name', ''), inp)
                        if act: acts.append((ts, act, c.get('name'), dict(inp, _head=head), c.get('id')))
                continue
            if d.get('type') != 'user' or d.get('isMeta'): continue
            if isinstance(content, list):
                for c in content:
                    if isinstance(c, dict) and c.get('type') == 'tool_result':
                        r = c.get('content'); r = r if isinstance(r, str) else ' '.join(x.get('text', '') for x in r or [] if isinstance(x, dict))
                        results[c.get('tool_use_id')] = (bool(c.get('is_error')), r[-4000:])
            t = texts(content).strip()
            if not t or SKIP.match(t): continue
            msgs.append((ts, t))
    if msgs: sessions.append({'id': os.path.basename(f)[:8], 'project': proj, 'cwd': cwd, 'msgs': msgs, 'acts': acts, 'results': results})

if not sessions: raise SystemExit(f'no sessions under {a.root}: nothing to harvest')
sessions.sort(key=lambda s: s['msgs'][0][0])   # oldest first, so [-n:] keeps the most recent
allm = [(s['id'], ts, t) for s in sessions for ts, t in s['msgs']]
working = [s for s in sessions if len(s['msgs']) >= 5]
days = {ts.date() for _, ts, _ in allm}
OPENER = {s['id']: s['msgs'][0][1][:140] for s in sessions}
rec = lambda sid, ts, t: {'text': t[:220], 'ts': ts.strftime('%Y-%m-%d %H:%M'), 'session': sid, 'flags': flags(t),
                          'sessionOpener': OPENER.get(sid, '')}   # context: a harmless line can come from a private session

# the day: the weekday with the most sessions, and its usual start time (mornings preferred)
by_wd = collections.Counter(s['msgs'][0][0].strftime('%A').lower() for s in sessions)
wd = by_wd.most_common(1)[0][0]
starts = [s['msgs'][0][0] for s in sessions if s['msgs'][0][0].strftime('%A').lower() == wd]
morning = [x for x in starts if x.hour < 12] or starts
mins = statistics.median(x.hour * 60 + x.minute for x in morning); mins = int(round(mins / 5) * 5)
day = {'weekday': wd, 'time': f'{mins // 60}:{mins % 60:02d}', 'sessionsOnThatDay': by_wd[wd], 'basis': f'median first message of {len(morning)} {wd} sessions'}

# openers: the first message of each session
openers = [rec(s['id'], *s['msgs'][0]) for s in sessions]
typical = [o for o in openers if not GREETING.match(o['text'])]
day_openers = [rec(s['id'], *s['msgs'][0]) for s in sessions
               if s['msgs'][0][0].strftime('%A').lower() == wd and not GREETING.match(s['msgs'][0][1])]

cands = {'first-message': day_openers[-25:] or typical[-25:]}
# quotable lines: match per sentence (split on . ! ? newlines and " - " asides) so a long message still yields a short,
# verbatim line; the receipt keeps the full message's timestamp and session
SENT = re.compile(r'(?<=[.!?])\s+|\n+|\s+-\s+')
for cat, (rx, maxlen) in CATS.items():
    hits = []
    for sid, ts, t in allm:
        if len(t) > 1500: continue                              # long messages are mostly pasted material
        for sn in (t, *SENT.split(t)) if len(t) > maxlen else (t,):
            sn = sn.strip()
            if 0 < len(sn) <= maxlen and not PASTED.search(sn) and rx.search(sn.lower()): hits.append(rec(sid, ts, sn)); break
    cands[cat] = hits[-60:]
# repeated short messages (check-ins, go-aheads): how often the user says the exact same thing
short = collections.Counter(re.sub(r'\s+', ' ', t.lower().strip(' ?!.')) for _, _, t in allm if len(t) <= 40)
repeats = [{'text': k, 'count': v} for k, v in short.most_common(40) if v >= 3]

# the routine: what an average session does, in the order it usually happens (position 0 = first message, 1 = last)
def pos(s, ts):
    a, b = s['msgs'][0][0], max(s['msgs'][-1][0], *(x[0] for x in s['acts'])) if s['acts'] else s['msgs'][-1][0]
    span = (b - a).total_seconds()
    return 0.0 if span <= 0 else max(0.0, min(1.0, (ts - a).total_seconds() / span))
act_first, act_all, act_count, examples = collections.defaultdict(list), collections.defaultdict(list), collections.defaultdict(list), collections.defaultdict(collections.Counter)
red_green, fail_lines, commits, prs = 0, collections.Counter(), [], []
for s in working:
    seen = collections.Counter()
    for ts, act, name, inp, tid in s['acts']:
        if act not in seen: act_first[act].append(pos(s, ts))
        seen[act] += 1; act_all[act].append(pos(s, ts))
        if act in ('read', 'edit') and inp.get('file_path'): examples[act][os.path.basename(inp['file_path'])] += 1
        elif name == 'Bash' and inp.get('_head'): examples[act][inp['_head'][:70]] += 1
        m = COMMIT_MSG.search(inp.get('command', '') or '') if name == 'Bash' else None
        if m: commits.append(rec(s['id'], ts, m.group(1) or m.group(2)))
        m = PR_TITLE.search(inp.get('command', '') or '') if name == 'Bash' else None
        if m: prs.append(rec(s['id'], ts, m.group(1) or m.group(2)))
    for act, k in seen.items(): act_count[act].append(k)
    # red → green: a failing test run followed later in the same session by a passing one
    runs = [(ts, s['results'].get(tid)) for ts, act, name, inp, tid in s['acts'] if act == 'test' and s['results'].get(tid)]
    failed_at = next((i for i, (_, (err, out)) in enumerate(runs) if err or FAIL.search(out)), None)
    if failed_at is not None:
        m = re.search(r'\b(\d+ (failed|failing))\b', runs[failed_at][1][1]); fail_lines[m.group(1) if m else 'FAIL'] += 1
        if any(not err and PASS.search(out) and not FAIL.search(out) for _, (err, out) in runs[failed_at + 1:]): red_green += 1
nw = max(1, len(working))
routine = sorted(({'activity': a, 'share': round(len(v) / nw, 2), 'medianFirstAt': round(statistics.median(v), 2),
                   'medianAt': round(statistics.median(act_all[a]), 2), 'medianCount': statistics.median(act_count[a]),
                   'examples': [{'text': k, 'flags': flags(k)} for k, _ in examples[a].most_common(8)]}
                  for a, v in act_first.items()), key=lambda r: r['medianAt'])
# where the user's own kinds of lines usually land in a session (to place those chapters in time)
said = collections.defaultdict(list)
for s in working:
    for ts, t in s['msgs'][1:]:
        for cat, (rx, maxlen) in CATS.items():
            if cat in ('building', 'knock', 'notes', 'good-part', 'restart', 'side-by-side', 'kept') and rx.search(t.lower()[:maxlen * 3]):
                said[cat].append(pos(s, ts))
said_at = {k: round(statistics.median(v), 2) for k, v in said.items() if len(v) >= 3}

# memory: the shelf
memory = []
for mf in glob.glob(os.path.join(a.root, '*', 'memory', '*.md')):
    if os.path.basename(mf) == 'MEMORY.md': continue
    head = open(mf, errors='ignore').read(1500)
    nm = re.search(r'^name:\s*(.+)$', head, re.M); ty = re.search(r'^\s*type:\s*(\w+)', head, re.M)
    slug = (nm.group(1) if nm else re.sub(r'^(feedback|project|reference|user)_', '', os.path.basename(mf)[:-3])).strip().strip('"\'')
    memory.append({'title': re.sub(r'[-_]+', ' ', slug), 'type': ty.group(1) if ty else None, 'file': os.path.basename(mf),
                   'modified': dt.datetime.fromtimestamp(os.path.getmtime(mf), TZ).strftime('%Y-%m-%d')})
memory.sort(key=lambda m: (m['type'] != 'feedback', m['modified']), reverse=False)
memory = [m for m in memory if m['type'] == 'feedback'] + [m for m in memory if m['type'] != 'feedback']

# CLAUDE.md: words the user wrote in capitals (a rule pinned to the wall)
caps = collections.Counter()
for cwd in {s['cwd'] for s in sessions if s['cwd']}:
    p = os.path.join(cwd, 'CLAUDE.md')
    if os.path.exists(p): caps.update(w for w in re.findall(r'\b[A-Z]{5,}\b', open(p, errors='ignore').read())
                                      if w not in {'CLAUDE', 'README', 'TODO', 'DOCTYPE', 'HTML', 'JSON', 'YAML', 'HTTPS', 'LICENSE', 'NOTE'})

first = min(allm, key=lambda x: x[1])
out = {
    'about': 'Candidate receipts for a day-in-my-life film, verbatim from local transcripts. Private: never commit or share.',
    'window': {'oldest': first[1].strftime('%Y-%m-%d'), 'newest': max(ts for _, ts, _ in allm).strftime('%Y-%m-%d'),
               'sessions': len(sessions), 'workingSessions': len(working), 'userMessages': len(allm), 'activeDays': len(days)},
    'stats': {
        'hellos': sum(1 for o in openers if GREETING.match(o['text'])), 'openers': len(openers),
        'openWithLink': sum(1 for o in openers if 'url' in o['flags']), 'openWithFile': sum(1 for o in openers if 'path' in o['flags']),
        'medianMessagesPerWorkingSession': statistics.median(len(s['msgs']) for s in working) if working else None,
        'medianHoursPerWorkingSession': round(statistics.median(min(24, (s['msgs'][-1][0] - s['msgs'][0][0]).total_seconds() / 3600) for s in working), 2) if working else None,
        'canWe': sum(1 for _, _, t in allm if 'can we' in t.lower()),
    },
    'day': day,
    'firstEver': rec(first[0], first[1], first[2]),
    'routine': {'about': 'what an average working session does, ordered by where it usually happens (medianAt; 0 = start, 1 = end); share = fraction of working sessions that do it at all',
                'steps': routine, 'userLinesAt': said_at,
                'tests': {'sessionsRedToGreen': red_green, 'typicalFailure': fail_lines.most_common(3)},
                'commits': commits[-25:], 'prs': prs[-15:]},
    'candidates': cands,
    'repeats': repeats,
    'memory': {'count': len(memory), 'titles': memory[:500], 'order': 'rules (type feedback) first, then the rest'},
    'claudeMdCaps': sorted(caps.items(), key=lambda kv: (-kv[1], kv[0]))[:10],
    'enough': len(sessions) >= 10 and len(days) >= 5,
}
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
json.dump(out, open(a.out, 'w'), indent=1, ensure_ascii=False)
print(f"{len(sessions)} sessions, {len(allm)} messages, {len(days)} active days ({out['window']['oldest']} → {out['window']['newest']})")
print(f"day: {day['weekday']}, {day['time']} · hellos {out['stats']['hellos']}/{len(openers)} · memory files {len(memory)} · enough material: {out['enough']}")
print('routine: ' + ' → '.join(f"{r['activity']} ({int(r['share'] * 100)}%)" for r in routine if r['share'] >= .25))
print('wrote', a.out)
