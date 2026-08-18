
import { cmp, Content } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'

import { envName } from '../helpers/packageMeta'


// The "Use with Station" README section (station design §9.4): rendered
// ONLY when the project's model carries the station feature (installed
// via `package add @voxgig/sdkgen-station`) — a project without it sees
// nothing. Documents the binding forms and the secret name; store
// configuration is sekreto's documentation, deliberately not restated
// here (one canonical source).

// Targets where station.connect(SDK) is the idiomatic binding; everything
// else uses inverted binding through the SDK's own constructor.
const CONNECT_TARGETS = ['ts', 'js', 'py', 'rb', 'php', 'lua', 'perl']

const ReadmeStation = cmp(function ReadmeStation(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const features = getModelPath(model, `main.${KIT}.feature`,
    { only_active: false, required: false }) || {}
  const station = Object.values(features)
    .find((f: any) => 'station' === f?.name)
  if (null == station) { return }

  const env = envName(model)
  const secretname = env.toLowerCase() + '.apikey'
  const connect = CONNECT_TARGETS.includes(target.name)

  Content(`
## Use with Station

This SDK ships as a [voxgig/station](https://github.com/voxgig/station)
plugin: bind it to a local \`Station\` and outbound configuration,
credentials, and observability move to one place. The feature is
present but **off by default** — nothing changes until you bind.

${connect
  ? `Bind by passing the SDK class to the station:

1. \`station = Station.open()\` — profile, env, and proxy all defaulted.
2. \`client = station.connect(${model.const.Name}SDK)\` — replaces direct
   construction.`
  : `Bind through the constructor this SDK already has (inverted
binding): open a station, then construct with station-built options —
\`station.options()\` merges the handle, the activation entry, and the
correct feature order into the plain options the constructor accepts.`}

The credential comes from [sekreto](https://github.com/voxgig/sekreto)
under the name \`${secretname}\` — by default the \`${env}_APIKEY\`
environment variable this README already documents, unchanged. Point a
profile in \`station.json\` at a vault later and application code does
not change; sekreto's own documentation covers the stores. The key
stays out of \`options()\` and \`prepare()\` output; \`station.tap(...)\`
shows live traffic.
`)
})


export {
  ReadmeStation
}
