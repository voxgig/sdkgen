import sys, re, textwrap
# Wrap lines that start with the marker "§W " at 74 columns; list items keep a hanging indent.
path = sys.argv[1]
out = []
for line in open(path, encoding='utf-8').read().split('\n'):
    if not line.startswith('§W '):
        out.append(line); continue
    body = line[3:]
    m = re.match(r'^(\s*)((?:- |\d+\. )?)(.*)$', body)
    lead, bullet, text = m.group(1), m.group(2), m.group(3)
    first = lead + bullet
    rest = lead + ' ' * len(bullet)
    w = textwrap.TextWrapper(width=74, initial_indent=first, subsequent_indent=rest,
                             break_long_words=False, break_on_hyphens=False)
    out.extend(w.wrap(text))
open(path, 'w', encoding='utf-8').write('\n'.join(out))
left = [l for l in out if '§W' in l]
print('wrapped; markers left:', len(left))
