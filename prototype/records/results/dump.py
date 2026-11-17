import json,sys
def dump(v,ind=0,out=None):
    pad='  '*ind
    if isinstance(v,dict):
        for k,x in v.items():
            if isinstance(x,(dict,list)):
                out.append(f'{pad}{k}:')
                dump(x,ind+1,out)
            else:
                s=str(x)
                if '\n' in s:
                    out.append(f'{pad}{k}: |')
                    for l in s.split('\n'): out.append(f'{pad}  {l}')
                else:
                    out.append(f'{pad}{k}: {s}')
    elif isinstance(v,list):
        for i,x in enumerate(v):
            if isinstance(x,(dict,list)):
                out.append(f'{pad}- [{i}]')
                dump(x,ind+1,out)
            else:
                s=str(x)
                if '\n' in s:
                    out.append(f'{pad}- |')
                    for l in s.split('\n'): out.append(f'{pad}  {l}')
                else:
                    out.append(f'{pad}- {s}')
    else:
        out.append(f'{pad}{v}')
for fn in sys.argv[1:]:
    d=json.load(open(fn))
    out=[]
    dump(d,0,out)
    open(fn.replace('.json','.txt'),'w').write('\n'.join(out)+'\n')
    print(fn, len(out),'lines')
