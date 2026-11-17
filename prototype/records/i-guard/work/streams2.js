const TS='/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/i-guard/sdkgen/ts'
const F=require(TS+'/dist-test/runtimeforms/forms.js')
const Fs=require('fs'),P=require('path')
for(const l of process.argv.slice(2)){const forms=require(TS+'/dist-test/runtimeforms/'+l+'.js').forms
 const ds=F.findDecls(forms,F.read(forms.files.entity),F.esc(forms.members.stream))
 for(const d of ds){const file=d.file.split('#')[0];const text=Fs.readFileSync(P.join(F.SCAFFOLD,file),'utf8');const at=text.indexOf(d.head);const line0=text.slice(0,at).split('\n').length
  const lines=text.slice(at).split('\n').slice(0,+process.env.N||120)
  console.log('=====',l,file,line0)
  lines.forEach((s,i)=>{if(i<3||/stream\(|\.stream|yield|materiali|runOp|run_op|Enumerator|Seq|chan|go func|coroutine|iterat|steps|Steps|lazy|sequence|AsyncStream|return|feature/i.test(s))console.log((line0+i)+': '+s)})}}
