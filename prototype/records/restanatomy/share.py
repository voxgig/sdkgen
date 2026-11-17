#!/usr/bin/env python3
"""Prose sharing per family and per block, over the 20 baseline READMEs.

usage: share.py <md-root> [--blocks] [--dump FAMILY] [--json out.json]

A unit is one sentence of a prose paragraph, one list item's sentence, one
table row's last cell, or one heading, after normalising: code spans -> §,
the language's title -> LANG, the SDK name -> SDK, entity names -> ENT,
whitespace collapsed. A unit is SHARED when the same normalised text occurs
in at least 15 of the 20 languages, LONE when it occurs in exactly one.
Counts are over unit instances (a sentence in 18 languages counts 18).
Words are counted the same way (words of each instance).
"""
import re, sys, json, collections
sys.path.insert(0, __import__('os').path.dirname(__file__))
from cut import cut_dir, LANGS, TITLES, HOWTO_LABEL

ENTS = ['Ambient', 'Console', 'GraphQl', 'History', 'Planet', 'Record', 'Utility',
        'ambient', 'console', 'graph_ql', 'history', 'planet', 'record', 'utility']
ALT = {'go': ['Golang', 'Go'], 'cpp': ['C\\+\\+'], 'csharp': ['C#'], 'c': ['C']}

FAMILIES = ['intro', 'install', 'quick', 'errors', 'howto', 'model', 'entity',
            'explanation', 'expl.shared', 'expl.table', 'features',
            'root:topquick', 'root:toptest', 'root:tophowto']


def norm(s, lang):
  s = re.sub(r'`[^`]*`', '§', s)
  s = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', s)
  titles = ALT.get(lang, []) + [re.escape(TITLES[lang])]
  for t in titles:
    s = re.sub(r'(?<![\w#+])' + t + r'(?![\w#+])', 'LANG', s)
  s = re.sub(r'Demo', 'SDK', s)
  for e in ENTS:
    s = re.sub(r'\b' + e + r'\b', 'ENT', s)
  s = re.sub(r'\s+', ' ', s).strip()
  return s


def units_of(items, lang):
  """(unit, words) pairs for prose; headings included."""
  units = []
  para = []

  def flush():
    if para:
      txt = ' '.join(para)
      for sen in re.split(r'(?<=[.!?:])\s+(?=[A-Z`(*\[])', txt):
        n = norm(sen, lang)
        if n and re.search(r'[A-Za-z]', n):
          units.append(n)
      para.clear()

  for ln, k in items:
    if k != 'text':
      flush(); continue
    v = ln.strip()
    if not v or v == '---':
      flush(); continue
    if v.startswith('#'):
      flush(); units.append('H:' + norm(v.lstrip('#').strip(), lang)); continue
    if v.startswith('|'):
      flush()
      cells = [c.strip() for c in v.strip('|').split('|')]
      if set(''.join(cells)) <= set('-: '):
        continue
      n = norm(cells[-1], lang)
      if n and re.search(r'[A-Za-z§]', n):
        units.append('|' + n)
      continue
    if re.match(r'^([-*]|\d+\.) ', v):
      flush()
      v = re.sub(r'^([-*]|\d+\.) ', '', v)
    if v.startswith('>'):
      v = v.lstrip('> ')
    para.append(v)
  flush()
  return units


def words(u):
  return len(re.findall(r'[A-Za-z§]+', u))


def blocks_of(items, lang):
  """Split a family section at ###/#### headings outside code."""
  out = collections.OrderedDict()
  cur = '(lead)'
  for ln, k in items:
    if k == 'text' and re.match(r'^#{3,4} ', ln):
      key = norm(re.sub(r'`[^`]*`', '§', ln.lstrip('#').strip()), lang)
      key = re.sub(r'§.*', '§', key)
      cur = key
    out.setdefault(cur, []).append((ln, k))
  return out


def stats(per_lang_units):
  have = list(per_lang_units)
  cnt = collections.Counter(u for l in have for u in set(per_lang_units[l]))
  r = collections.Counter()
  for l in have:
    for u in per_lang_units[l]:
      w = words(u)
      r['units'] += 1; r['words'] += w
      c = cnt[u]
      if c >= 15: r['s15'] += 1; r['s15w'] += w
      if c == 1: r['lone'] += 1; r['lonew'] += w
      if 2 <= c < 15: r['mid'] += 1; r['midw'] += w
  r['distinct'] = len(cnt)
  return r, cnt


def lines_of(items):
  c = collections.Counter()
  for ln, k in items:
    if not ln.strip(): continue
    c['code' if k != 'text' else 'prose'] += 1
  return c


def main():
  md = sys.argv[1]
  args = sys.argv[2:]
  data = cut_dir(md)
  out = {}
  for fam in FAMILIES:
    pl = {l: units_of(data[l].get(fam, []), l) for l in LANGS if fam in data[l]}
    r, cnt = stats(pl)
    lc = collections.Counter()
    for l in LANGS:
      lc.update(lines_of(data[l].get(fam, [])))
    out[fam] = dict(r, langs=len(pl), prose_lines=lc['prose'], code_lines=lc['code'])
    pct = lambda a, b: f"{100*a/max(1,b):3.0f}%"
    print(f"{fam:<14} langs={len(pl):>2} units={r['units']:>4} distinct={r['distinct']:>4} "
          f"s15={r['s15']:>4} ({pct(r['s15'],r['units'])}) lone={r['lone']:>4} ({pct(r['lone'],r['units'])}) "
          f"| words={r['words']:>5} s15w {pct(r['s15w'],r['words'])} lonew {pct(r['lonew'],r['words'])} "
          f"| prose_lines={lc['prose']:>5} code_lines={lc['code']:>5}")
    if '--blocks' in args:
      bl = {l: blocks_of(data[l].get(fam, []), l) for l in LANGS if fam in data[l]}
      keys = []
      for l in bl:
        for k in bl[l]:
          if k not in keys: keys.append(k)
      for k in keys:
        have = [l for l in bl if k in bl[l]]
        pu = {l: units_of(bl[l][k], l) for l in have}
        rr, _ = stats(pu)
        cl = sum(lines_of(bl[l][k])['code'] for l in have)
        miss = [l for l in LANGS if l not in have]
        tag = (' only:' + ','.join(have)) if len(have) <= 6 else ((' missing:' + ','.join(miss)) if miss else '')
        print(f"    {k[:46]:<46} n={len(have):>2} u={rr['units']:>4} s15={pct(rr['s15'],rr['units'])} lone={pct(rr['lone'],rr['units'])} code={cl:>4}{tag}")
    if '--dump' in args and args[args.index('--dump') + 1] == fam:
      for l in LANGS:
        if l not in pl: continue
        lone = [u for u in pl[l] if cnt[u] == 1]
        mid = [u for u in pl[l] if 1 < cnt[u] < 15]
        print(f'===== {l} lone={len(lone)} mid={len(mid)}')
        for u in lone: print('   L', u)
        for u in mid: print(f'   M{cnt[u]:>2}', u)
  if '--json' in args:
    json.dump(out, open(args[args.index('--json') + 1], 'w'), indent=1)


if __name__ == "__main__":
  main()
