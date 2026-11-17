const F=require(process.argv[2]+'/dist-test/runtimeforms/forms.js')
for(const t of ['ts','go','py','c','zig','clojure','rust','elixir','rb']){
  const forms=require(process.argv[2]+'/dist-test/runtimeforms/'+t+'.js').forms
  const out=F.OPS.map(op=>{const m=F.opMethod(forms,op);return op+'='+(m.method||'?'+m.why)})
  console.log(t, out.join(' | '))
}
