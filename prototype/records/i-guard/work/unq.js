const TS='/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/i-guard/sdkgen/ts'
const G=require(TS+'/dist-test/runtimeforms/guard.js'),A=require(TS+'/dist-test/runtimeforms/account.js'),F=require(TS+'/dist-test/runtimeforms/forms.js')
const Fs=require('fs'),P=require('path')
const wordIn=(tok,text)=>new RegExp('(^|[^\\w])'+tok.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^\\w])').test(text)
for(const t of G.PROVIDERS){const forms=G.formsOf(t);for(const [p,c] of Object.entries(forms.cite||{})){for(const tok of Object.keys(c.unquoted||{})){
 const w=A.runtimeFiles(t).filter(f=>wordIn(tok,Fs.readFileSync(P.join(F.SCAFFOLD,f),'utf8')))
 console.log(t,p,tok,w.length,w.slice(0,6).join(' '))}}}
