// node put.js < entries.json : merges {id:{verdict,note}} into sentences.json
const fs=require('fs');const f=__dirname+'/sentences.json';
const cur=fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):{sentences:{}};
const add=JSON.parse(fs.readFileSync(0,'utf8'));
Object.assign(cur.sentences,add);fs.writeFileSync(f,JSON.stringify(cur,null,1)+'\n');
console.log('verdicts',Object.keys(cur.sentences).length);
