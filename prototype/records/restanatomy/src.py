#!/usr/bin/env python3
"""Per family: source lines, blank/comment-free lines, lines inside template
literals (text the component prints) vs logic, model-reading lines, the
helpers imported from @voxgig/sdkgen and from utility_<lang>."""
import re, glob, collections, os
CMP = '/home/user/sdkgen/ts/project/.sdk/src/cmp'
LANGS = 'ts js go py php rb lua csharp java kotlin scala swift rust c cpp zig perl clojure elixir ocaml'.split()
FAMS = ['ReadmeIntro','ReadmeInstall','ReadmeHowto','ReadmeModel','ReadmeOptions','ReadmeEntity','ReadmeExplanation','ReadmeTopQuick','ReadmeTopHowto','ReadmeTopTest','ReadmeQuick','ReadmeRef']
MODEL = re.compile(r'\bmodel\b|getModelPath|entityCollection|isAuthActive|isHttpBasic|\bent\.|\bentity\b|\bfeature\b|target\.(name|options|module|publish)|ctx\$')
for f in FAMS:
  tot = nb = tmpl = modl = 0
  helpers = collections.Counter(); util = collections.Counter(); langcond = 0
  per = {}
  for l in LANGS:
    p = f'{CMP}/{l}/{f}_{l}.ts'
    if not os.path.exists(p): continue
    src = open(p).read()
    lines = src.split('\n')
    tot += len(lines); per[l] = len(lines)
    intl = False
    for ln in lines:
      s = ln.strip()
      bt = len(re.findall(r'(?<!\\)`', ln))
      in_before = intl
      if bt % 2: intl = not intl
      if not s or s.startswith('//'): continue
      nb += 1
      if in_before and intl: tmpl += 1
      elif in_before or intl: tmpl += 1
      if MODEL.search(ln): modl += 1
    m = re.search(r"import \{([^}]*)\} from '@voxgig/sdkgen'", src, re.S)
    if m:
      for h in re.split(r'[,\s]+', m.group(1)):
        if h: helpers[h] += 1
    for m in re.finditer(r"import \{([^}]*)\} from '\./(utility_\w+|[A-Z]\w+)'", src, re.S):
      for h in re.split(r'[,\s]+', m.group(1)):
        if h: util[m.group(2) + ':' + h] += 1
  print(f'{f:<18} files={len(per):>2} lines={tot:>5} nonblank={nb:>5} template={tmpl:>5} logic={nb-tmpl:>5} modelread_lines={modl:>4} min={min(per.values())} max={max(per.values())}')
  print('   sdkgen helpers:', ' '.join(f'{k}:{v}' for k, v in helpers.most_common() if k not in ('cmp','Content','File','Folder','each','names')))
  if util: print('   local imports:', ' '.join(f'{k}:{v}' for k, v in util.most_common(12)))
