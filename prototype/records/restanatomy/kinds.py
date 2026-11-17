#!/usr/bin/env python3
"""Sharing split by unit kind: sentence, table cell, heading; units and words."""
import sys, collections, json
sys.path.insert(0, '.')
from cut import cut_dir, LANGS
from share import units_of, words
d = cut_dir(sys.argv[1])
FAMS = ['intro','install','quick','errors','howto','model','entity','explanation','expl.table']
tot = collections.Counter()
rows = {}
for f in FAMS:
  pl = {l: units_of(d[l].get(f, []), l) for l in LANGS}
  cnt = collections.Counter(u for l in LANGS for u in set(pl[l]))
  r = collections.Counter()
  for l in LANGS:
    for u in pl[l]:
      k = 'head' if u.startswith('H:') else ('cell' if u.startswith('|') else 'sent')
      w = words(u); c = cnt[u]
      r[k+'_u'] += 1; r[k+'_w'] += w
      if c >= 15: r[k+'_s15u'] += 1; r[k+'_s15w'] += w
      if c == 1: r[k+'_loneu'] += 1; r[k+'_lonew'] += w
  rows[f] = r
  s = r
  print(f"{f:<12} sentences {s['sent_u']:>4} s15 {100*s['sent_s15u']/max(1,s['sent_u']):3.0f}% lone {100*s['sent_loneu']/max(1,s['sent_u']):3.0f}% (words {s['sent_w']:>5}: s15 {100*s['sent_s15w']/max(1,s['sent_w']):3.0f}% lone {100*s['sent_lonew']/max(1,s['sent_w']):3.0f}%) | cells {s['cell_u']:>4} s15 {100*s['cell_s15u']/max(1,s['cell_u']):3.0f}% | heads {s['head_u']:>3} s15 {100*s['head_s15u']/max(1,s['head_u']):3.0f}%")
  if f not in ('errors','expl.table'): tot.update(r)
s = tot
print(f"PER-LANG FAMILIES (excl errors, expl.table): sentences {s['sent_u']} s15 {100*s['sent_s15u']/s['sent_u']:.0f}% lone {100*s['sent_loneu']/s['sent_u']:.0f}% words s15 {100*s['sent_s15w']/s['sent_w']:.0f}% lone {100*s['sent_lonew']/s['sent_w']:.0f}% | cells {s['cell_u']} s15 {100*s['cell_s15u']/s['cell_u']:.0f}% words s15 {100*s['cell_s15w']/s['cell_w']:.0f}% | heads {s['head_u']} s15 {100*s['head_s15u']/s['head_u']:.0f}%")
json.dump(rows, open('kinds-B.json','w'), indent=1)
