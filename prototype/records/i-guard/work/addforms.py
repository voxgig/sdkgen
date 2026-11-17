import json,re
D='/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/i-guard/sdkgen/ts/test/runtimeforms/'
cand=json.load(open('cand.json'))
def runs_items(l):
  import os
  f,con,st,run,draw=cand[l]
  t=open('/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/i-guard/sdkgen/ts/project/.sdk/'+f).read()
  after='from the call, beside the caller' if st=='at call' else 'as the caller iterates'
  return ('before it returns' if t.index(run)<t.index(con) else after, 'before it returns' if t.index(draw)<=t.index(con) else after)
DIMS={
 'ts': {'testDecl':"'test'"},
 'js': {'testDecl':"'test'", 'expect':"{ test: { on: 'type' } }"},
 'go': {'testDecl':"'TestSDK'", 'on':"(d) => /^func \\(/.test(d.head) ? 'instance' : 'module'",
        'fails':"(d) => /\\berror\\)$/.test(d.returns) ? 'second value error' : ''", 'failure':"{ shows: 'error', call: 'err' }"},
 'py': {'testDecl':"'test'", 'on':"(d) => '__init__' === d.name || /^[ \\t]*@(classmethod|staticmethod)\\b[^\\n]*\\n[ \\t]*$/.test(d.before) ? 'type' : 'instance'"},
 'rb': {'testDecl':"'test'", 'parenless':'true', 'field':'() => false', 'returnsFrom':"() => 'comment'",
        'on':"(d) => 'initialize' === d.name || /def self\\./.test(d.head) ? 'type' : 'instance'"},
 'php': {'testDecl':"'test'", 'expect':"{ test: { on: 'type' } }"},
 'lua': {'testDecl':"'test'", 'returnsFrom':"() => 'comment'",
         'on':"(d) => /\\.[\\w\\\\]+$/.test(d.head) ? 'type' : 'instance'",
         'fails':"(d) => 1 < d.returns.split(', ').length ? 'second value ' + d.returns.split(', ')[1] : ''",
         'failure':"{ shows: 'second value', call: 'err' }", 'expect':"{ test: { on: 'type' }, new: { on: 'type' }, load: { on: 'instance' } }"},
 'csharp': {'testDecl':"'TestSDK'", 'expect':"{ TestSDK: { on: 'type' } }"},
 'java': {'testDecl':"'testSDK'", 'expect':"{ testSDK: { on: 'type' } }"},
 'kotlin': {'testDecl':"'testSDK'", 'on':"(d) => 'ProjectNameSDK' === d.name || 'EntyClass' === d.name || (/^    fun /.test(d.head) && /companion object \\{/.test(d.before)) ? 'type' : 'instance'",
            'expect':"{ testSDK: { on: 'type' }, name: { field: true } }"},
 'scala': {'testDecl':"'testSDK'", 'on':"(d) => 'ProjectNameSDK' === d.name || 'EntyClass' === d.name || /\\nobject \\w+ \\{/.test(d.before) ? 'type' : 'instance'",
           'expect':"{ testSDK: { on: 'type' } }"},
 'swift': {'testDecl':"'testSDK'", 'fails':"(d) => { const b = bracketed(d.rest, 0, '('); return null != b && /^\\s*throws\\b/.test(d.rest.slice(b.end)) ? 'throws' : '' }",
           'failure':"{ shows: 'throws', call: 'try' }", 'expect':"{ testSDK: { on: 'type', fails: '' }, prepare: { fails: 'throws' }, stream: { fails: 'throws' }, direct: { fails: '' } }"},
 'rust': {'testDecl':"'test_sdk'", 'on':"(d) => /^\\(\\s*(&\\s*)?(mut\\s+)?self\\b/.test(d.rest) ? 'instance' : (/^[ \\t]+/.test(d.head) ? 'type' : 'module')",
          'fails':"(d) => /^Result</.test(d.returns) ? 'Result' : ''", 'failure':"{ shows: 'Result', call: 'unwrap' }"},
 'c': {'testDecl':"'test_sdk'", 'on':"(d) => /\\(\\*/.test(d.head) ? 'instance' : 'module'",
       'fails':"(d) => /PNError\\*\\*/.test(d.params[d.params.length - 1] || '') ? 'error parameter PNError**' : ''", 'failure':"{ shows: 'PNError**', call: '&err' }"},
 'cpp': {'testDecl':"'testSDK'", 'expect':"{ testSDK: { on: 'type' } }"},
 'zig': {'testDecl':"'test_sdk'", 'on':"(d) => /^\\(self\\s*:/.test(d.rest) ? 'instance' : (/^[ \\t]+/.test(d.head) ? 'type' : 'module')",
         'fails':"(d) => /Result$/.test(d.returns) ? 'error union ' + d.returns : ''", 'failure':"{ shows: 'Result', call: '.err' }"},
 'perl': {'testDecl':"'test'", 'on':"(d) => /^\\s*\\{\\s*(?:#[^\\n]*\\n\\s*)*my\\s*\\(\\s*\\$class\\b/.test(d.rest) ? 'type' : (/^\\s*\\{\\s*(?:#[^\\n]*\\n\\s*)*my\\s*\\(\\s*\\$self\\b/.test(d.rest) ? 'instance' : 'module')",
          'expect':"{ test: { on: 'type' }, new: { on: 'type' }, load: { on: 'instance' } }"},
 'clojure': {'testDecl':"'test-sdk'", 'on':"(d) => /^\\s*:/.test(d.head) ? 'instance' : 'module'"},
 'elixir': {'testDecl':"'test'", 'on':"() => 'module'"},
 'ocaml': {'testDecl':"'test'", 'on':"(d) => /^\\s*mutable /.test(d.head) ? 'instance' : 'module'",
           'expect':"{ e_name: { field: true }, e_deleted: { field: true }, e_data: { field: true }, e_load: { field: false }, test: { on: 'module' } }"},
}
import sys
ONLY=sys.argv[1:]
for l,dims in DIMS.items():
  if ONLY and l not in ONLY: continue
  p=D+l+'.ts'
  s=open(p).read()
  f,con,st,run,draw=cand[l]
  r,i=runs_items(l)
  lines=['  // What the table states besides names, parameters and returns.']
  for k in ['testDecl','on','field','parenless','fails','failure','returnsFrom','expect']:
    if k in dims: lines.append(f'  {k}: {dims[k]},')
  lines.append('  stream: {')
  lines.append(f'    file: {json.dumps(f)},')
  lines.append(f'    construct: {json.dumps(con)}, starts: {json.dumps(st)},')
  lines.append(f'    run: {json.dumps(run)},')
  lines.append(f'    draw: {json.dumps(draw)},')
  lines.append(f'    runs: {json.dumps(r)}, items: {json.dumps(i)},')
  lines.append('  },')
  block='\n'.join(lines)+'\n'
  assert s.count('\n}\n\nexport { forms }')==1, l
  s=s.replace('\n}\n\nexport { forms }','\n'+block+'}\n\nexport { forms }')
  if 'bracketed(' in block and 'import { bracketed' not in s:
    s=s.replace("import type { Forms } from './forms'","import type { Forms } from './forms'\nimport { bracketed } from './forms'")
  open(p,'w').write(s)
print('done')
