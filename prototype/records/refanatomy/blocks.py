#!/usr/bin/env python3
"""Split each language's REFERENCE.md into canonical blocks and measure how
much prose is the same sentence across languages.

usage: blocks.py <md-root> [--dump BLOCK] [--json out.json]
"""
import re, sys, json, collections

LANGS = 'ts js go py php rb lua csharp java kotlin scala swift rust c cpp zig perl clojure elixir ocaml'.split()
ENTS = ['Ambient', 'Console', 'GraphQl', 'History', 'Planet', 'Record', 'Utility']
OPS = ['load', 'list', 'create', 'update', 'patch', 'remove']

root = sys.argv[1]
args = sys.argv[2:]


def title_of(text):
  m = re.match(r'# (\S+) (.+) SDK Reference', text.split('\n', 1)[0])
  return m.group(1), m.group(2)


def heading_key(level, h, section, sub):
  """Map a heading to a canonical block id."""
  hl = h.lower()
  code = re.sub(r'`', '', h)
  if section == 'client':
    if level == 3:
      if re.search(r'constructor$|make-sdk', hl) and 'test' not in hl and 'static' not in hl:
        return 'client.ctor'
      return 'client.h3:' + ('static' if re.search(r'static|test|constructors', hl) else 'instance')
    if 'cancel' in hl:
      return 'client.cancel'
    if re.search(r'tester', hl):
      return 'client.tester'
    if re.search(r'\btest\(\)', hl):
      return 'client.test0'
    if re.search(r'test', hl):
      return 'client.test'
    if re.search(r'option', hl):
      return 'client.options'
    if re.search(r'direct', hl):
      return 'client.direct'
    if re.search(r'prepare', hl):
      return 'client.prepare'
    if re.search(r'(data|entopts)', hl):
      return 'client.accessor'
    if re.search(r'utility', hl):
      return 'client.utility'
    return 'client.other:' + code
  if section == 'entity':
    if level == 3:
      if hl.startswith('fields'):
        return 'entity.fields'
      if 'usage' in hl:
        return 'entity.fieldusage'
      if hl.startswith('actions'):
        return 'entity.actions'
      if hl.startswith('operations'):
        return 'entity.ops'
      if hl.startswith('common'):
        return 'entity.common'
      return 'entity.other3:' + h
    if sub == 'entity.ops':
      for op in OPS:
        if re.search(r'(^|[^a-z])(e_)?' + op + r'[^a-z]', hl):
          return 'entity.op.' + op
      return 'entity.op.?' + code
    if sub == 'entity.common':
      k = re.sub(r'[^a-z]', '', re.split(r'[(\s]', code.replace('vt->', '').replace('((:', '').replace('e_', ''), maxsplit=1)[0].lower())
      # normalise the accessor family names
      k = {'datasetdata': 'dataset'}.get(k, k)
      if re.search(r'data', code.lower()) and 'set' in code.lower(): k = 'data.set'
      elif re.search(r'data', code.lower()): k = 'data'
      elif re.search(r'match', code.lower()) and 'set' in code.lower(): k = 'match.set'
      elif re.search(r'match', code.lower()): k = 'match'
      elif 'make' in code.lower(): k = 'make'
      elif 'name' in code.lower(): k = 'name'
      elif 'stream' in code.lower(): k = 'stream'
      elif 'client' in code.lower(): k = 'client'
      elif 'entopts' in code.lower(): k = 'entopts'
      return 'entity.common.' + k
    return 'entity.other4:' + code
  if section == 'features':
    if level == 3:
      return 'features.configuring'
    if hl == 'ordering':
      return 'features.ordering'
    return 'features.each'
  return 'other'


def parse(lang):
  text = open(f'{root}/{lang}/REFERENCE.md').read()
  sdk, title = title_of(text)
  lines = text.split('\n')
  blocks = collections.OrderedDict()
  cur = 'title'
  section = 'top'
  sub = None
  inc = False
  heads = []

  def add(key, kind, val):
    blocks.setdefault(key, []).append((kind, val))

  for i, ln in enumerate(lines):
    if ln.startswith('```'):
      inc = not inc
      add(cur, 'code', ln)
      continue
    if inc:
      add(cur, 'code', ln)
      continue
    m = re.match(r'^(#{1,4}) (.*)$', ln)
    if m:
      level = len(m.group(1)); h = m.group(2)
      if level == 1:
        cur = 'title'
      elif level == 2:
        if h == 'Features':
          section = 'features'; cur = 'features.summary'
        elif section == 'top':
          section = 'client'; cur = 'client.head'
        else:
          section = 'entity'; cur = 'entity.head'; sub = None
      else:
        k = heading_key(level, h, section, sub)
        if level == 3 and section == 'entity':
          sub = k
        cur = k
      heads.append((level, cur, h))
      add(cur, 'head', h)
      continue
    add(cur, 'line', ln)
  return sdk, title, blocks, heads


def norm(s, sdk, title):
  s = re.sub(r'`[^`]*`', '§', s)
  s = re.sub(r'(?<![\w#+])' + re.escape(title) + r'(?![\w#+])', 'LANG', s)
  s = re.sub(r'\b' + re.escape(sdk) + r'\b', 'SDK', s)
  for e in ENTS:
    s = re.sub(r'\b' + e + r'\b', 'ENT', s)
  s = re.sub(r'\s+', ' ', s).strip()
  return s


def prose_units(items, sdk, title):
  """Prose sentences and table description cells, normalised."""
  units = []
  para = []

  def flush():
    if para:
      txt = ' '.join(para)
      for sen in re.split(r'(?<=[.!?])\s+(?=[A-Z`(*])', txt):
        n = norm(sen, sdk, title)
        if n:
          units.append(n)
      para.clear()

  for kind, val in items:
    if kind != 'line':
      flush(); continue
    v = val.strip()
    if not v or v == '---':
      flush(); continue
    if v.startswith('|'):
      flush()
      cells = [c.strip() for c in v.strip('|').split('|')]
      if set(''.join(cells)) <= set('- '):
        continue
      units.append('|' + norm(cells[-1], sdk, title))
      continue
    para.append(v)
  flush()
  return units


data = {}
for l in LANGS:
  sdk, title, blocks, heads = parse(l)
  data[l] = dict(sdk=sdk, title=title, blocks=blocks, heads=heads)

if '--dump' in args:
  b = args[args.index('--dump') + 1]
  for l in LANGS:
    it = data[l]['blocks'].get(b)
    print('=====', l)
    if it:
      for u in sorted(set(prose_units(it, data[l]['sdk'], data[l]['title']))):
        print('   ', u)
  sys.exit()

order = []
for l in LANGS:
  for k in data[l]['blocks']:
    if k not in order:
      order.append(k)

rows = []
for b in order:
  have = [l for l in LANGS if b in data[l]['blocks']]
  sets = {l: set(prose_units(data[l]['blocks'][b], data[l]['sdk'], data[l]['title'])) for l in have}
  cnt = collections.Counter(u for l in have for u in sets[l])
  inst = sum(len(sets[l]) for l in have)
  s15 = sum(1 for l in have for u in sets[l] if cnt[u] >= 15)
  s75 = sum(1 for l in have for u in sets[l] if cnt[u] >= max(2, 0.75 * len(have)))
  lone = sum(1 for l in have for u in sets[l] if cnt[u] == 1)
  codel = sum(1 for l in have for k, v in data[l]['blocks'][b] if k == 'code')
  rows.append(dict(block=b, langs=len(have), have=have, units=inst, distinct=len(cnt),
                   shared15=s15, shared75=s75, lone=lone, code=codel))

tot = collections.Counter()
for r in rows:
  for k in ('units', 'shared15', 'shared75', 'lone', 'code'):
    tot[k] += r[k]
  missing = [l for l in LANGS if l not in r['have']]
  print(f"{r['block']:<28} langs={r['langs']:>2} units={r['units']:>4} distinct={r['distinct']:>3} "
        f"s15={r['shared15']:>4} ({100*r['shared15']/max(1,r['units']):3.0f}%) s75={r['shared75']:>4} "
        f"({100*r['shared75']/max(1,r['units']):3.0f}%) lone={r['lone']:>3} code={r['code']:>4}"
        + (f"  missing: {' '.join(missing)}" if 0 < len(missing) < 20 and len(missing) <= 10 else '')
        + (f"  only: {' '.join(r['have'])}" if len(r['have']) <= 5 else ''))
print('TOTAL', dict(tot), f"s15={100*tot['shared15']/tot['units']:.0f}% s75={100*tot['shared75']/tot['units']:.0f}% lone={100*tot['lone']/tot['units']:.0f}%")

if '--json' in args:
  json.dump(rows, open(args[args.index('--json') + 1], 'w'), indent=1)
