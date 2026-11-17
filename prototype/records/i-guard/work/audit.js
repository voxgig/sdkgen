const Fs=require('fs')
const lines=Fs.readFileSync('report1.txt','utf8').split('\n')
let lang=null; const out=[]
const changed={
 'ts ref.facts.client[0].returns':'unquoted object replaced by a quote of MakeOptionsUtility layer, where options are built as objects',
 'ts ref.facts.prepare.returns':'unquoted Promise replaced by a quote of the async direct beside it (Promise<DirectResult>); prepare itself is an async method with no annotation, so this shows the class\'s async methods resolve a Promise, not prepare\'s own type',
 'ts ref.facts.body.values':'unquoted Uint8Array replaced by a quote of `return new Uint8Array(chunk)`; Buffer stays unquoted (8 lines away only in unrelated code)',
 'ts ref.facts.none':'new: `return undefined`',
 'go ref.facts.cancel':'was a quote of http.NewRequest (cannot show absence); now an absence search over fetcher.go',
 'go notes.member:stream':'added the quote of callopts["ctrl"], a token the note names',
 'go ref.facts.none':'new: `return nil, err`',
 'py ref.facts.direct.returns':'added `if isinstance(fetched, dict):`; shows direct handles a dict response, the result itself is a dict literal (dict still not spelled for the result)',
 'py ref.facts.cancel':'was `timeout = fetchdef.get("timeout")` (unrelated); now an absence search over fetcher.py',
 'py ref.facts.none':'new: `def load(self, reqmatch=None, ctrl=None)`',
 'py ref.facts.lits.true':'new: the computed ok line; True unquoted (computed, not spelled)',
 'py ref.facts.lits.false':'new: `return {"ok": False, ...}`',
 'rb ref.facts.direct.returns':'added the comment `({ "ok" => ..., ... })`; Hash still unquoted',
 'rb ref.facts.prepare.returns':'unquoted Hash replaced by the comment naming the fetchdef Hash (a comment, where the code returns make_fetch_def\'s value)',
 'rb ref.facts.cancel':'was the Net::HTTP.new line; now an absence search over fetcher.rb',
 'rb ref.facts.none':'new: `def load(reqmatch = nil, ctrl = nil)`',
 'clojure ref.facts.cancel':'was the http-client def; now an absence search over core.clj',
 'clojure notes.instance':'added `(ns sdk.client`; the call form unquoted',
 'clojure ref.facts.none':'new: a comment (`nil = empty match`): no code line spells the default',
 'elixir ref.facts.cancel':'was the :httpc.request line; now an absence search over utility.ex (pattern narrowed: :aborted is a :global.trans result)',
 'elixir notes.ctor':'added `def new(options \\\\ nil)` for `options`; deep/1 unquoted',
 'elixir ref.facts.none':'new: `def load(ent, reqmatch \\\\ nil, ctrl \\\\ nil)`',
 'zig ref.facts.cancel':'was the fetcher_util signature; now an absence search over utility.zig',
 'zig notes.member:prepare':'try/catch unquoted (language keywords)',
 'zig notes.member:streamList':'added `.ok` and the ctrl read; callopts.ctrl unquoted (an option path)',
 'c ref.facts.cancel':'was the file header comment; now an absence search over http.c',
 'c ref.facts.none':'new: `if (*err) return NULL;`',
 'rust ref.facts.cancel':'was the ureq agent line; now an absence search over fetcher.rs',
}
for(let i=0;i<lines.length;i++){const l=lines[i]
 let m=/^([a-z]+): derived/.exec(l); if(m){lang=m[1];continue}
 m=/^  cited ahead of a declaration (\S+) = (.*)$/.exec(l); if(m){out.push({lang,fact:m[1]+' = '+m[2]+' (cited before the provider declares it)',shows_value:'yes',changed:'new'});continue}
 m=/^  cited( \((prose|absence)[^)]*\))? (\S+) = (.*)$/.exec(l); if(m){
  const kind=m[2]==='prose'?'pinned prose':m[2]==='absence'?'absence':'yes'
  let file=(lines[i+1]||'').trim().slice(0,90)
  const unq=[];let j=i+2;while((lines[j]||'').startsWith('    unquoted')){unq.push(lines[j].trim());j++}
  const key=lang+' '+m[3]
  let shows=kind
  if(['py ref.facts.direct.returns','rb ref.facts.direct.returns','ts ref.facts.prepare.returns'].includes(key)) shows='no'
  out.push({lang,fact:m[3]+' = '+m[4].slice(0,80)+' | '+file+(unq.length?' | '+unq.join('; ').slice(0,160):''),shows_value:shows,changed:changed[key]||'none'})}}
Fs.writeFileSync('audit.json',JSON.stringify(out,null,1))
const c={};for(const x of out){c[x.lang+' '+x.shows_value]=(c[x.lang+' '+x.shows_value]||0)+1};console.log(out.length,c)
