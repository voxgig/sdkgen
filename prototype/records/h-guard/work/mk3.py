import json,re
s=open('../sdkgen/ts/test/runtimeforms/zig.ts').read()
m=re.search(r"reason: '(?:[^'\\]|\\.)*'",s).group(0)
json.dump([{'id':'my-types-reason-dropped-zig','lang':'zig','edits':[{'file':'test/runtimeforms/zig.ts','from':m,'to':"reason: ' '"}]}],open('muts3.json','w'))
print(m[:70])
