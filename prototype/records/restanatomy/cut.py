#!/usr/bin/env python3
"""Cut a language README (and the root README) into the sections each
documentation family writes.

Language README, in Readme.ts order (every anchor is a heading or a fixed
sentence the SHARED frame prints, so the cut does not depend on what a
per-language component writes):

  intro.frame   '# <Name> <Title> SDK' + tagline                (ReadmeIntro.ts)
  intro         after the tagline up to the alongside note      (ReadmeIntro_<lang>)
  install       after '## Install' up to '## Tutorial'          (ReadmeInstall_<lang>)
  quick         '## Tutorial' up to '## Error handling'         (ReadmeQuick_<lang>) [stage 1]
  errors        '## Error handling' up to '## How-to guides'    (ReadmeErrors.ts LANGS table)
  howto         after '## How-to guides' up to '## Reference'   (ReadmeHowto_<lang>)
  model         after '## Reference' up to '## Entities' / '## Features'
                                                                (ReadmeModel_<lang> + ReadmeOptions_<lang>)
  entity        '## Entities' up to '## Features'               (ReadmeEntity_<lang>)
  features      '## Features' up to '## Advanced'               (ReadmeFeatures.ts, shared)
  expl.shared   '## Advanced' .. 'later features can override earlier ones.'
                                                                (ReadmeExplanation.ts frame + LANGS featureKind)
  explanation   after that sentence up to '### Entity state' or '### Direct vs entity access'
                                                                (ReadmeExplanation_<lang>)
  expl.table    '### Entity state' .. '## Full Reference'       (ReadmeExplanation.ts LANGS entityState/direct)

Root README, per language:
  topquick  '### <Title>' under '## Quickstart' / '## Quickstart in other languages'
  toptest   '### <Title>' under '## Offline unit testing'
  tophowto  '**<Title>:**' under '### Make a direct API call'
"""
import re, sys, json, os

LANGS = 'ts js go py php rb lua csharp java kotlin scala swift rust c cpp zig perl clojure elixir ocaml'.split()
TITLES = {'ts': 'TypeScript', 'js': 'JavaScript', 'go': 'Golang', 'py': 'Python', 'php': 'PHP',
          'rb': 'Ruby', 'lua': 'Lua', 'csharp': 'C#', 'java': 'Java', 'kotlin': 'Kotlin',
          'scala': 'Scala', 'swift': 'Swift', 'rust': 'Rust', 'c': 'C', 'cpp': 'C++', 'zig': 'Zig',
          'perl': 'Perl', 'clojure': 'Clojure', 'elixir': 'Elixir', 'ocaml': 'OCaml'}
# the root how-to labels some languages differently from the ### titles
HOWTO_LABEL = dict(TITLES, go='Go')


def lines_with_fence(text):
  out = []
  inc = False
  for ln in text.split('\n'):
    if ln.startswith('```'):
      out.append((ln, 'fence'))
      inc = not inc
      continue
    out.append((ln, 'code' if inc else 'text'))
  return out


def cut_lang(text):
  secs = {}
  cur = None
  ls = lines_with_fence(text)
  for i, (ln, k) in enumerate(ls):
    if k == 'text':
      if ln.startswith('# ') and i == 0:
        cur = 'intro.frame'; secs.setdefault(cur, []).append((ln, k)); continue
      if cur == 'intro.frame' and ln.strip() and not ln.startswith('#'):
        # first non-empty line after the title is the tagline only if the
        # model has one; B has none, so the per-language body starts here.
        cur = 'intro'
      if ln.startswith('> Other languages'):
        cur = 'intro.alongside'
      m = re.match(r'^## (.*)$', ln)
      if m:
        h = m.group(1)
        cur = {'Install': 'install', 'Error handling': 'errors', 'How-to guides': 'howto',
               'Reference': 'model', 'Entities': 'entity', 'Features': 'features',
               'Advanced': 'expl.shared', 'Full Reference': 'tail'}.get(h, cur)
        if h.startswith('Tutorial'):
          cur = 'quick'
        if h.startswith('Use with Station'):
          cur = 'station'
        if h in ('Install', 'How-to guides', 'Reference'):
          # the heading itself is printed by the shared wrapper
          secs.setdefault(cur + '.frame', []).append((ln, k)); continue
      if cur == 'explanation' and (ln.startswith('### Entity state') or ln.startswith('### Direct vs entity access')):
        cur = 'expl.table'
    secs.setdefault(cur, []).append((ln, k))
    if cur == 'expl.shared' and k == 'text' and 'later features can override earlier ones.' in ln:
      cur = 'explanation'
  return secs


def cut_root(text):
  """Per language: topquick, toptest, tophowto."""
  out = {l: {} for l in LANGS}
  bytitle = {v: k for k, v in TITLES.items()}
  bylabel = {v: k for k, v in HOWTO_LABEL.items()}
  h2 = None
  cur = None
  for ln, k in lines_with_fence(text):
    if k == 'text':
      m = re.match(r'^## (.*)$', ln)
      if m:
        h2 = m.group(1); cur = None
        continue
      m = re.match(r'^### (.*)$', ln)
      if m:
        t = m.group(1)
        cur = None
        if h2 in ('Quickstart', 'Quickstart in other languages') and t in bytitle:
          cur = (bytitle[t], 'topquick')
        elif h2 == 'Offline unit testing' and t in bytitle:
          cur = (bytitle[t], 'toptest')
        continue
      m = re.match(r'^\*\*(.+):\*\*$', ln)
      if m and h2 == 'How-to guides' and m.group(1) in bylabel:
        cur = (bylabel[m.group(1)], 'tophowto')
        continue
    if cur:
      out[cur[0]].setdefault(cur[1], []).append((ln, k))
  return out


def cut_dir(md):
  res = {}
  for l in LANGS:
    p = f'{md}/{l}/README.md'
    if os.path.exists(p):
      res[l] = cut_lang(open(p).read())
  rp = f'{md}/README.md'
  root = cut_root(open(rp).read()) if os.path.exists(rp) else None
  if root:
    for l in LANGS:
      if root[l]:
        res.setdefault(l, {}).update({'root:' + k: v for k, v in root[l].items()})
  return res


if __name__ == '__main__':
  md = sys.argv[1]
  r = cut_dir(md)
  for l in LANGS:
    if l in r:
      print(l, {k: len(v) for k, v in r[l].items()})
