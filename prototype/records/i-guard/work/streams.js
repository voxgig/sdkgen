const TS='/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/i-guard/sdkgen/ts'
const F=require(TS+'/dist-test/runtimeforms/forms.js')
const langs=process.argv.slice(2)
for(const l of langs){const forms=require(TS+'/dist-test/runtimeforms/'+l+'.js').forms
 const ds=F.findDecls(forms,F.read(forms.files.entity),F.esc(forms.members.stream))
 for(const d of ds){console.log('=====',l,d.file,'\n'+d.head+d.rest.split('\n').slice(0,+process.env.N||45).join('\n'))}}
