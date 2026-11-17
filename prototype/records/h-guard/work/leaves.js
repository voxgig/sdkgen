const Path=require('path')
const STAGE=Path.resolve(__dirname,'../sdkgen/ts/dist-test-scaffold/.sdk/dist/cmp')
const langs=process.argv.slice(2)
function leaves(x,pre,out){ if(null==x||'object'!==typeof x){out.push([pre,x]);return}
 if(Array.isArray(x)){x.forEach((v,i)=>leaves(v,pre+'['+i+']',out));return}
 for(const[k,v]of Object.entries(x))leaves(v,pre?pre+'.'+k:k,out)}
for(const t of langs){const S=require(Path.join(STAGE,t,'Syntax_'+t+'.js')).Syntax
 const out=[];leaves(S.facts,'facts',out);if(S.ref)leaves(S.ref.facts,'ref.facts',out);if(S.notes)for(const k of Object.keys(S.notes))out.push(['notes.'+k,S.notes[k].slice(0,80)])
 console.log('=== '+t+' '+out.length);for(const[k,v]of out)console.log('  '+k+' = '+JSON.stringify(v))}
