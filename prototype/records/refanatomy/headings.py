# Count heading lines that change under the proposed single scheme (B output).
import re, sys
root=sys.argv[1]
L='ts js go py php rb lua csharp java kotlin scala swift rust c cpp zig perl clojure elixir ocaml'.split()
FUNC={'clojure':'Functions','elixir':'Functions','ocaml':'Functions'}
CLASS_ENT={'csharp','java','kotlin','scala','swift','perl'}  # class is <Name>Entity, heading drops the suffix
CANON=['list','load','create','update','patch','remove']
for l in L:
  t=open(f'{root}/{l}/REFERENCE.md').read().split('\n')
  w=FUNC.get(l,'Methods')
  sec='top'; ch=0; tot=0; detail=[]
  ops=[]; reorder=0
  for ln in t:
    m=re.match(r'^(#{1,4}) (.*)$',ln)
    if not m: continue
    tot+=1; lv=len(m.group(1)); h=m.group(2)
    if lv==2:
      if h=='Features': sec='feat'
      elif sec=='top': sec='client'
      else:
        if ops and [o for o in CANON if o in ops]!=ops: reorder+=1
        sec='ent'; ops=[]
        if l in CLASS_ENT: ch+=1; detail.append(h)
      continue
    if lv==3 and sec=='client':
      want=None
      if h in('Constructor',) : want=h
      elif h=='make-sdk': want='Constructor'
      elif re.search(r'static|test|constructors',h,re.I): want='Test client'
      else: want='Instance '+w
      if h!=want: ch+=1; detail.append(h+'->'+want)
    if lv==3 and sec=='ent' and h.startswith('Common'):
      want='Common '+w
      if h!=want: ch+=1; detail.append(h+'->'+want)
    if lv==4 and sec=='ent':
      for o in ['load','list','create','update','patch','remove']:
        if re.search(r'(^|[^a-z])(e_)?'+o+r'[^a-z_]',h.lower()) and o not in ops and not re.search('data|match|name|make',h.lower()): ops.append(o)
  if ops and [o for o in CANON if o in ops]!=ops: reorder+=1
  print(f"{l:8} headings={tot:4} changed={ch:3} entity-sections-reordered={reorder}  {'; '.join(sorted(set(detail)))[:150]}")
