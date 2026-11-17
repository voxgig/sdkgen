# Re-measure sharing after replacing language-API facts (error convention,
# return verb, collection noun, container noun, null literal) with tokens.
import re, sys, collections
sys.argv=['blocks.py', sys.argv[1]]
exec(open('blocks.py').read().split("if '--dump' in args:")[0])
ERR=[r',? and § the branded error', r',? and § a failure', r'; § is non-nil on failure', r',? or § and an error on failure',
     r',? or § with § set on failure', r',? and (raises|throws|dies) on error', r'(raises|throws|dies) on error']
def tok(u):
  for e in ERR: u=re.sub(e,' ERR',u)
  u=re.sub(r'^(Returns|Resolves to|§ is|§ carries)\b','RET',u)
  u=re.sub(r'\b(an? )?(§-terminated array|§ list|arrayref|array|list|vector|slice|§)( of entities)',r'COLL\3',u)
  u=re.sub(r'\((dicts|hashes|tables|arrays|dictionaries|objects|hashrefs|Maps|maps) are JSON-serialized\)','(CONTAINERs are JSON-serialized)',u)
  u=re.sub(r'\b(raises|throws|dies)\b','ERRV',u)
  u=re.sub(r'\s+',' ',u).strip(); u=re.sub(r' ERR ERR',' ERR',u); u=re.sub(r' ERR\.','.',u) if False else u
  return u
tot=collections.Counter()
for b in ['entity.op.load','entity.op.list','entity.op.create','entity.op.update','entity.op.remove','client.prepare','client.direct']:
  sets={l:set(tok(u) for u in prose_units(data[l]['blocks'][b],data[l]['sdk'],data[l]['title'])) for l in LANGS if b in data[l]['blocks']}
  cnt=collections.Counter(u for s in sets.values() for u in s)
  inst=sum(len(s) for s in sets.values()); s15=sum(1 for s in sets.values() for u in s if cnt[u]>=15)
  print(f"{b:20} units={inst:4} distinct={len(cnt):3} s15={s15:4} ({100*s15/inst:.0f}%)")
  if '-v' in sys.argv[2:] or True:
    for u,c in sorted(cnt.items(),key=lambda x:-x[1])[:0]: print('   ',c,u)
