
import {
  cmp, omap, each, cmap,
  File, Content,
} from '@voxgig/sdkgen'



const Package = cmp(async function Package(props: any) {
  const { target, ctx$: { model } } = props
  const { main: { sdk: { feature } } } = model

  const only = (kind: string, deps: any) =>
    omap(deps, ([k, v]: any) => [v.active && kind === v.kind ? k : undefined, v.version])

  // merge target and feature deps, by kind
  const deps =
    each(feature, (feature: any) =>
      omap(feature.deps[target.name], ([k, v]: any) =>
        [v.active ? k : undefined, v]))
      // TODO: sort by version; rules for version choice?
      .reduce((a: any, deps: any) => (each(deps, (dep: any) =>
        a[dep.kind][dep.key$] = dep.version), a),
        {
          prod: only('prod', target.deps),
          peer: only('peer', target.deps),
          dev: only('dev', target.deps),
        })

  // TODO: complete SDK meta data in model and use here
  const pkg = {
    name: `${model.const.name}-sdk`,
    version: `0.0.1`,
    description: 'DESCRIPTION',
    main: `src/${model.const.Name}SDK.js`,
    scripts: {
      'test': 'node --test test/*.test.js',
      'test-utility': 'node --test test/utility/*.test.js',
      'test-accept': 'node --test test/accept/*.test.js',
      'test-all': 'npm run test && npm run test-utility',

      "watch": "tsc --build src test -w",
      "build": "tsc --build src test",
      "clean": "rm -rf node_modules yarn.lock package-lock.json",
      "reset": "npm run clean && npm i && npm run build && npm test",
    },
    author: `${model.const.Name}`,
    license: 'MIT',
    dependencies: deps.prod,
    peerDependencies: deps.peer,
    devDependencies: deps.dev,
  }


  File({ name: 'package.json' }, () => {
    Content(JSON.stringify(pkg, null, 2))
  })
})


export {
  Package
}
