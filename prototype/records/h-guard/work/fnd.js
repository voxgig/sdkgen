// prints guard + account findings per language; usage: node fnd.js <ts-dir> [lang...]
const G=require(process.argv[2]+'/dist-test/runtimeforms/guard.js')
const langs=process.argv.slice(3).length?process.argv.slice(3):G.PROVIDERS
for(const t of langs){const forms=G.formsOf(t);if(!forms){console.log(t,'NO FORMS');continue}
 const r=G.full(t,G.syntaxOf(t),forms)
 console.log('== '+t+' '+r.all.length+' findings')
 for(const x of r.all)console.log('  ['+x.check+'] '+x.what.slice(0,220))}
