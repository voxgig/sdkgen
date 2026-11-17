#!/usr/bin/env python3
"""For each stored variation, which languages' family sections differ from B.
Stored variations keep only files that differ from B; a missing file means
'same as B' unless the language is not generated in that variation (lone-*,
lang-off-*), which is skipped."""
import os, sys, collections, json
sys.path.insert(0, os.path.dirname(__file__))
from cut import cut_dir, LANGS
OUT = '/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/spike/out'
FAMS = ['intro','install','quick','errors','howto','model','entity','explanation','expl.shared','expl.table','features','root:topquick','root:toptest','root:tophowto']
B = cut_dir(OUT + '/B/md')
res = {}
for v in sorted(os.listdir(OUT)):
  if v == 'B' or v.startswith('lang-off') or v.startswith('lone') or v.startswith('phase') or v.startswith('multi') or v.startswith('output') or v.startswith('root-'):
    continue
  md = OUT + '/' + v + '/md'
  if not os.path.isdir(md): continue
  V = cut_dir(md)
  rootchanged = os.path.exists(md + '/README.md')
  row = {}
  for f in FAMS:
    ch = []
    for l in LANGS:
      if f.startswith('root:'):
        if not rootchanged: continue
      elif not os.path.exists(f'{md}/{l}/README.md'): continue
      a = [x[0] for x in B[l].get(f, [])]
      b = [x[0] for x in V.get(l, {}).get(f, [])]
      if a != b: ch.append(l)
    if ch: row[f] = ch
  res[v] = row
json.dump(res, open('react.json','w'), indent=1)
# a family is suspicious where a switch changes it in some languages but not most
for v, row in res.items():
  for f, ch in row.items():
    if 0 < len(ch) < 20:
      print(f'{v:<24} {f:<14} {len(ch):>2}/20  {" ".join(ch) if len(ch) < 12 else "all but " + " ".join(l for l in LANGS if l not in ch)}')
