import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fs from 'node:fs'
import Path from 'node:path'
import Os from 'node:os'
import { spawnSync } from 'node:child_process'
import { memfs } from 'memfs'
import { SdkGen } from '../dist/sdkgen'
import { makeModel, makeRoot, layeredFs, makeLog, STAGE, SCAFFOLD } from './generateharness'
const PKG = Path.resolve(__dirname, '..')
for (const target of ['ts','js']) test('generated ' + target + ' eight-route scenarios and HTTP failure matrix', async () => {
  const tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-scenarios-'))
  try {
    const model = makeModel([target], undefined, undefined, ['test'])
    const fixture = JSON.parse(Fs.readFileSync(Path.join(PKG,'test/live-univec-model.json'),'utf8'))
    Object.assign(model.main.kit, fixture)
    const { fs, vol } = memfs({})
    const generator = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog() })
    const cwd = process.cwd()
    try { process.chdir(SCAFFOLD); await generator.generate({ model, root: makeRoot() }) }
    finally { process.chdir(cwd) }
    const root = Path.join(tmp,target)
    for (const [file, content] of Object.entries(vol.toJSON())) {
      const rel = Path.relative(STAGE,file).split(Path.sep).join('/')
      if (!rel.startsWith(target+'/') || content == null) continue
      const dest=Path.join(root,rel.slice(target.length+1)); Fs.mkdirSync(Path.dirname(dest),{recursive:true}); Fs.writeFileSync(dest,content)
    }
    Fs.symlinkSync(Path.join(PKG,'node_modules'),Path.join(root,'node_modules'),'dir')
    if (target === 'ts') for (const tree of ['src','test']) {
      const built=spawnSync(process.execPath,[Path.join(PKG,'node_modules/typescript/bin/tsc'),'--build',tree],{cwd:root,encoding:'utf8',timeout:30000})
      assert.equal(built.status,0,built.stdout+built.stderr)
    }
    const env: NodeJS.ProcessEnv={...process.env,SDK_LIVE_ROOT:root,SDK_LIVE_TARGET:target}; delete env.NODE_TEST_CONTEXT
    const result=spawnSync(process.execPath,['--test',Path.join(PKG,'test/live-scenario-probe.cjs')],{cwd:root,env,encoding:'utf8',timeout:60000})
    assert.equal(result.status,0,result.stdout+result.stderr)
    assert.match(result.stdout, /pass 12/)
  } finally { Fs.rmSync(tmp,{recursive:true,force:true}) }
})
