#!/usr/bin/env python3
"""Map catalogue entries to the families they name (by component file)."""
import re, collections, json
t = open('/home/user/sdkgen/docs/design/model-dependent-text-issues.md').read()
ents = re.split(r'\n(?=### [A-Z]+\d+\. )', t)
FAM = ['ReadmeModel','ReadmeEntity','ReadmeHowto','ReadmeInstall','ReadmeExplanation','ReadmeIntro','ReadmeOptions',
       'ReadmeTopQuick','ReadmeTopHowto','ReadmeTopTest','ReadmeErrors','ReadmeTop','opExample','AgentGuide','ReadmeStation','ReadmeQuick','ReadmeRef']
res = collections.defaultdict(list)
out = {}
for e in ents:
  m = re.match(r'### ([A-Z]+\d+)\. (.*)', e)
  if not m: continue
  i, title = m.group(1), m.group(2)
  fate = re.search(r'\*\*Fate\.\*\* ([^\n]*)', e); fate = fate.group(1) if fate else ''
  cls = re.search(r'\*\*Class\.\*\* ([^\n]*)', e); cls = cls.group(1) if cls else ''
  hit = []
  for f in FAM:
    pat = r'\b' + f + (r'(_|\.ts|\b)' if f != 'ReadmeTop' else r'(\.ts)')
    if re.search(pat, e): hit.append(f)
  out[i] = dict(title=title, fate=fate, cls=cls, fams=hit)
  for f in hit: res[f].append(i)
for f in FAM:
  print(f, len(res[f]), ' '.join(res[f]))
json.dump(out, open('cat.json','w'), indent=1)
