#!/usr/bin/env python3
"""Upper and lower bound of prose that is a document about one language.
LOWER: whole blocks present in 6 or fewer languages (a heading of their own)
       plus every lone sentence of explanation and install.
UPPER: LOWER plus every other lone unit in the per-language families.
Words and units, over B."""
import sys, collections
sys.path.insert(0, '.')
from cut import cut_dir, LANGS
from share import units_of, words, blocks_of
d = cut_dir(sys.argv[1])
FAMS = ['intro','install','quick','howto','model','entity','explanation']
allu = {f: {l: units_of(d[l].get(f, []), l) for l in LANGS} for f in FAMS}
cnt = {f: collections.Counter(u for l in LANGS for u in set(allu[f][l])) for f in FAMS}
totw = sum(words(u) for f in FAMS for l in LANGS for u in allu[f][l])
totu = sum(len(allu[f][l]) for f in FAMS for l in LANGS)
low = collections.Counter(); up = collections.Counter()
for f in FAMS:
  bl = {l: blocks_of(d[l].get(f, []), l) for l in LANGS}
  keys = collections.Counter(k for l in LANGS for k in bl[l])
  for l in LANGS:
    small = set()
    for k, items in bl[l].items():
      if k != '(lead)' and keys[k] <= 6:
        for u in units_of(items, l): small.add(u); low[f+'_u'] += 1; low[f+'_w'] += words(u)
    for u in allu[f][l]:
      if u in small: continue
      if cnt[f][u] == 1:
        if f in ('explanation', 'install'):
          low[f+'_u'] += 1; low[f+'_w'] += words(u)
        else:
          up[f+'_u'] += 1; up[f+'_w'] += words(u)
lw = sum(v for k, v in low.items() if k.endswith('_w')); lu = sum(v for k, v in low.items() if k.endswith('_u'))
uw = lw + sum(v for k, v in up.items() if k.endswith('_w')); uu = lu + sum(v for k, v in up.items() if k.endswith('_u'))
print('total units', totu, 'words', totw)
print('LOWER', lu, f'{100*lu/totu:.0f}%', lw, f'{100*lw/totw:.0f}%', dict(low))
print('UPPER', uu, f'{100*uu/totu:.0f}%', uw, f'{100*uw/totw:.0f}%', dict(up))
