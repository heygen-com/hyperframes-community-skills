"""harvest.py: find the raw material for a session story in the agent's own local history with its user.

Reads the transcripts your agent keeps on this machine, groups them into sessions, and sorts every message the user
typed into requests, corrections and praise, with the agent's own short replies and the local time of each. Sums up
the routine (how long a session runs, when it starts, what you do together) and lists the most typical sessions
first. Nothing leaves the machine; the only file written is --out.

  python3 scripts/harvest.py                         # Claude Code + Codex sessions for the current folder
  python3 scripts/harvest.py --project ~/code/app    # another project folder
  python3 scripts/harvest.py --all-projects          # every project (ask your user first)
  python3 scripts/harvest.py --session <id>          # one session in full, in order

Sources (read only):
  Claude Code   ~/.claude/projects/<project-slug>/*.jsonl      (subagent sidechains skipped)
  Codex CLI     ~/.codex/sessions/**/rollout-*.jsonl, ~/.codex/archived_sessions/*.jsonl
Other agents: read your own history however your tool keeps it, and write the same shape (references/sources.md).
"""
import argparse, glob, json, math, os, re, sys
from collections import Counter
from datetime import datetime
from statistics import median

SKIP = re.compile(r'^\s*(<|\[Request interrupted|Caveat:|This session is being continued|# AGENTS\.md|<environment_context>)')
KINDS = {   # (pattern, weight): a message can match several; the heaviest wins
    'praise': [(r"\b(amazing|awesome|incredible|beautiful|perfect|love (it|this|that|these)|so (cool|good|nice)|great (job|work)?|nailed it|killer|brilliant|wow|thank(s| you)|exactly|nice|yes+!+)\b|🔥|❤️|🙌", 3)],
    'correction': [(r"^(no|nope|nah|wait|hmm+|ugh|stop)\b|\b(wrong|broken|broke|still (not|doesn'?t|isn'?t)|not (right|what|working)|doesn'?t (work|look)|isn'?t (right|working)|why (did|is|are|does) (you|it|this)|you (changed|broke|forgot|missed|deleted)|should (be|have) been|instead of|we have to|revert|undo|idk why|that'?s not)\b|\?!|!!\?", 3)],
    'request': [(r"^(can|could|would) you|^(please|pls|let'?s|lets|now|next|ok(ay)?,? (now|let'?s|can)|go ahead|build|make|create|add|write|render|fix|try|i want|i need|i'?d like|help)\b", 2), (r"\b(can you|could you|please)\b", 1)],
}
FLAGS = {
    'secret': re.compile(r'\b(sk-[\w-]{8,}|sk_[A-Za-z0-9]{8,}|ghp_\w{8,}|github_pat_|xox[abpr]-|AKIA[0-9A-Z]{12,})|-----BEGIN'),
    'email': re.compile(r'[\w.+-]+@[\w-]+\.[\w.]+'),
    'path': re.compile(r'(^|\s)(/Users/|/home/|~/|[A-Z]:\\)'),
    'url': re.compile(r'https?://\S+', re.I),
    'number': re.compile(r'\b\d{4,}\b'),
    'name?': re.compile(r'(?<=[a-z,] )[A-Z][a-z]{2,}\b'),   # a capitalised word mid-sentence: maybe a person or a client
    'person?': re.compile(r"\b(my|our|his|her|their) (teammate|colleague|coworker|boss|manager|client|friend|wife|husband|partner|girlfriend|boyfriend|mom|dad|sister|brother|son|daughter)\b|(^|\s)@[a-z0-9_]{2,}", re.I),
    'file': re.compile(r'\b[\w-]+\.(jpe?g|png|gif|heic|mov|mp4|pdf|docx?|xlsx?|csv|key|pptx?)\b', re.I),
}

def classify(text):
    t = text.strip().lower()
    scores = {k: sum(w for p, w in pats if re.search(p, t)) for k, pats in KINDS.items()}
    k = max(scores, key=scores.get)
    return (k if scores[k] > 0 else 'other'), scores

def flags(text):
    return [k for k, p in FLAGS.items() if p.search(text)]

def slug(path):   # Claude Code's project folder name: every non-alphanumeric character becomes '-'
    return re.sub(r'[^A-Za-z0-9]', '-', os.path.abspath(path))

def texts(content, want):
    if isinstance(content, str): return [content]
    out = []
    for c in content or []:
        if isinstance(c, dict) and c.get('type') in want and isinstance(c.get('text'), str): out.append(c['text'])
    return out

def first_line(text, n=90):
    s = re.split(r'(?<=[.!?:])\s|\n', text.strip(), maxsplit=1)[0].strip()
    return s if len(s) <= n else s[:n].rsplit(' ', 1)[0] + '…'

def claude_sessions(project, all_projects):
    root = os.path.expanduser('~/.claude/projects')
    dirs = glob.glob(os.path.join(root, '*')) if all_projects else [os.path.join(root, slug(project))]
    for d in dirs:
        for f in sorted(glob.glob(os.path.join(d, '*.jsonl'))):
            turns, pending = [], None
            for line in open(f, encoding='utf-8', errors='replace'):
                try: o = json.loads(line)
                except ValueError: continue
                if o.get('isSidechain') or o.get('isMeta') or o.get('isCompactSummary'): continue
                m = o.get('message') or {}
                at = o.get('attachment') if o.get('type') == 'attachment' and isinstance(o.get('attachment'), dict) else None
                if at and at.get('type') == 'queued_command':
                    # typed while the agent was busy, and handed to it mid-turn (a queued message delivered between turns
                    # arrives as an ordinary user message instead)
                    t = at.get('prompt') or at.get('content')
                    if isinstance(t, str) and t.strip() and not SKIP.match(t) and not any(x['text'] == t.strip() for x in turns[-3:]):
                        pending = {'t': o.get('timestamp'), 'text': t.strip(), 'reply': None}; turns.append(pending)
                elif o.get('type') == 'user' and m.get('role') == 'user':
                    for t in texts(m.get('content'), ('text',)):
                        if t.strip() and not SKIP.match(t) and not any(x['text'] == t.strip() for x in turns[-3:]):
                            pending = {'t': o.get('timestamp'), 'text': t.strip(), 'reply': None}; turns.append(pending)
                elif o.get('type') == 'assistant' and pending is not None:
                    for t in texts(m.get('content'), ('text',)):
                        if t.strip(): pending['reply'], pending['reply_t'] = t.strip(), o.get('timestamp')   # the last thing said before the user spoke again
            if turns: yield {'agent': 'claude-code', 'id': os.path.basename(f)[:-6], 'project': os.path.basename(d), 'turns': turns}

def codex_sessions(project, all_projects):
    files = glob.glob(os.path.expanduser('~/.codex/sessions/**/rollout-*.jsonl'), recursive=True) + glob.glob(os.path.expanduser('~/.codex/archived_sessions/*.jsonl'))
    want = os.path.abspath(project)
    for f in sorted(files):
        turns, pending, cwd = [], None, None
        for line in open(f, encoding='utf-8', errors='replace'):
            try: o = json.loads(line)
            except ValueError: continue
            p = o.get('payload') if isinstance(o.get('payload'), dict) else {}
            if cwd is None and isinstance(p.get('cwd'), str): cwd = p['cwd']
            if o.get('type') != 'response_item' or p.get('type') != 'message': continue
            if p.get('role') == 'user':
                for t in texts(p.get('content'), ('input_text',)):
                    if t.strip() and not SKIP.match(t):
                        pending = {'t': o.get('timestamp'), 'text': t.strip(), 'reply': None}; turns.append(pending)
            elif p.get('role') == 'assistant' and pending is not None:
                for t in texts(p.get('content'), ('output_text',)):
                    if t.strip(): pending['reply'], pending['reply_t'] = t.strip(), o.get('timestamp')
        if turns and (all_projects or (cwd and os.path.abspath(cwd) == want)):
            yield {'agent': 'codex', 'id': os.path.basename(f)[:-6].split('-', 6)[-1], 'project': cwd or '?', 'turns': turns}

def when(ts):   # an ISO timestamp → a local datetime
    try: return datetime.fromisoformat(str(ts).replace('Z', '+00:00')).astimezone()
    except ValueError: return None

STOP = set('''a about above after again all also am an and any are as at be because been before being below between both but by can
could did do does doing don't down during each few for from further had has have having he her here hers him his how i i'm if in into is
it it's its just let's like me more most my no nor not now of off ok okay on once only or other our out over own please same she should so
some such than that that's the their them then there these they this those through to too under until up very was we were what when where
which while who why will with would you your yeah yes can you it we i'll gonna want need make see get go going know think one also still
really right thing things lets use using way'''.split())

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--project', default=os.getcwd())
    ap.add_argument('--all-projects', action='store_true')
    ap.add_argument('--agent', choices=['auto', 'claude-code', 'codex'], default='auto')
    ap.add_argument('--session', help='print one session in order, with your replies')
    ap.add_argument('--full', action='store_true', help='with --session: every message and reply in full')
    ap.add_argument('--out', default='session-story-candidates.json')
    ap.add_argument('--top', type=int, default=8, help='sessions to list')
    ap.add_argument('--sort', choices=['typical', 'arc'], default='typical', help='typical: closest to the average session (default); arc: most drama')
    a = ap.parse_args()

    sessions = []
    if a.agent in ('auto', 'claude-code'): sessions += list(claude_sessions(a.project, a.all_projects))
    if a.agent in ('auto', 'codex'):
        norm = lambda t: re.sub(r'\s+', ' ', t).strip().lower()[:80]   # Codex can import Claude Code sessions: skip the copies
        seen = [{norm(t['text']) for t in s['turns']} for s in sessions]
        copy = lambda s: any(len({norm(t['text']) for t in s['turns']} & k) >= .6 * len(s['turns']) for k in seen)
        sessions += [s for s in codex_sessions(a.project, a.all_projects) if not copy(s)]
    if not sessions:
        print('no local sessions found for', a.project, '. Try --project <folder>, --all-projects, or references/sources.md for other agents')
        sys.exit(1)
    for s in sessions:
        for tr in s['turns']:
            tr['kind'], _ = classify(tr['text'])
            tr['flags'] = flags(tr['text'])
            tr['chars'] = len(tr['text'])
            if tr['reply']: tr['reply_first_line'] = first_line(tr['reply'])
            w = when(tr['t']); tr['local'] = w.strftime('%H:%M') if w else None
            w = when(tr.get('reply_t')); tr['reply_local'] = w.strftime('%H:%M') if w else None
            tr.pop('reply_t', None)
            if tr['reply'] and a.full: tr['reply_full'] = tr['reply']
            if tr['chars'] > 600 and not a.full: tr['text'] = tr['text'][:600] + ' …[cut]'
            tr.pop('reply', None)
        c = Counter(tr['kind'] for tr in s['turns'])
        s['counts'] = dict(c)
        s['start'], s['end'] = s['turns'][0]['t'], s['turns'][-1]['t']
        a0, a1 = when(s['start']), when(s['end'])
        s['minutes'] = round((a1 - a0).total_seconds() / 60) if a0 and a1 else 0
        s['local'] = f"{a0.strftime('%a %H:%M') if a0 else '?'} → {a1.strftime('%H:%M') if a1 else '?'}"
        s['arc'] = (c['request'] > 0) + (c['correction'] > 0) + (c['praise'] > 0) + min(2, c['praise'] + c['correction']) / 2

    # the routine: what an average session with this user looks like, so the film tells a typical one
    real = [s for s in sessions if len(s['turns']) >= 3] or sessions
    med_n, med_m = median(len(s['turns']) for s in real), median(max(1, s['minutes']) for s in real)
    total = Counter(tr['kind'] for s in real for tr in s['turns']); n_all = sum(total.values()) or 1
    mix = {k: total[k] / n_all for k in ('request', 'correction', 'praise', 'other')}
    for s in sessions:
        n = len(s['turns']); f = {k: s['counts'].get(k, 0) / n for k in mix}
        s['typical'] = round(abs(math.log(n / med_n)) + abs(math.log(max(1, s['minutes']) / med_m)) + sum(abs(f[k] - mix[k]) for k in mix), 3)
    words = Counter(w for s in real for tr in s['turns'] if tr['kind'] != 'praise'
                    for w in re.findall(r"[a-z][a-z'-]{2,}", re.sub(r'\S*[/@\\]\S*|https?\S+', ' ', tr['text'].lower())) if w not in STOP)
    starts = [when(s['start']) for s in real if when(s['start'])]
    routine = {'sessions': len(real), 'median_messages': med_n, 'median_minutes': med_m, 'mix': {k: round(v, 2) for k, v in mix.items()},
               'usual_start': f"{int(median(d.hour for d in starts)):02d}:00" if starts else None,
               'common_words': [w for w, _ in words.most_common(20)]}

    if a.session:
        s = next((s for s in sessions if s['id'].startswith(a.session) or s['id'].endswith(a.session)), None)
        if not s: print('no session', a.session); sys.exit(1)
        print(f"{s['agent']} {s['id']}  {s['start']} → {s['end']}  {len(s['turns'])} messages\n")
        print('times are local. The reply shown is your LAST message before they spoke again; --full prints everything.\n')
        for i, tr in enumerate(s['turns']):
            short = tr['text'] if tr['chars'] <= 160 or a.full else tr['text'][:160] + '…'
            print(f"{i:3} {tr['local'] or '':6} {tr['kind']:10} {'!' + ','.join(tr['flags']) if tr['flags'] else '':12} {short!r}")
            if a.full and tr.get('reply_full'): print(f"{'':32}↳ {tr['reply_local'] or '':6} {tr['reply_full']!r}")
            elif tr.get('reply_first_line'): print(f"{'':32}↳ {tr['reply_local'] or '':6} {tr['reply_first_line']!r}")
        return

    if a.sort == 'arc': sessions.sort(key=lambda s: (s['arc'], len(s['turns'])), reverse=True)
    else: sessions.sort(key=lambda s: s['typical'])
    json.dump({'project': os.path.abspath(a.project), 'routine': routine, 'sessions': sessions}, open(a.out, 'w'), indent=1)
    print(f"{len(sessions)} sessions, {sum(len(s['turns']) for s in sessions)} user messages → {a.out}\n")
    r = routine
    print(f"the routine: {r['median_messages']:.0f} messages over {r['median_minutes']:.0f} min, usually starting around {r['usual_start']}; "
          f"{r['mix']['request']:.0%} requests, {r['mix']['correction']:.0%} corrections, {r['mix']['praise']:.0%} praise")
    print('what you do together:', ', '.join(r['common_words']), '\n')
    print('most typical sessions first' if a.sort == 'typical' else 'fullest arc first (request + correction + praise)')
    for s in sessions[:a.top]:
        c = s['counts']
        print(f"  {s['id'][:8]}  {s['agent']:11} {(s['start'] or '')[:10]}  {s['local']:16} {len(s['turns']):3} msgs  "
              f"req {c.get('request', 0):2}  corr {c.get('correction', 0):2}  praise {c.get('praise', 0):2}   {first_line(s['turns'][0]['text'], 50)!r}")
    print(f"\nnext: python3 scripts/harvest.py --project {a.project} --session <id>   to read one in order")

if __name__ == '__main__':
    main()
