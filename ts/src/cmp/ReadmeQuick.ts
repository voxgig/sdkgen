
import { Content } from 'jostraca'
import { cmp } from '../helpers/component'

import { credentialPlacement, loadOptional } from '../utility'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$ } = props
  const placement = credentialPlacement(ctx$.model)

  Content(`
## Tutorial: your first API call

This tutorial walks through creating a client, listing entities, and
loading a specific record.${'' === placement ? '' : ' ' + placement}

`)

  const t = target.name

  // A target's own component still wins: a project override, an older copy,
  // or a packaged target that has not moved to a provider.
  const own = loadOptional(ctx$, `./cmp/${t}/ReadmeQuick_${t}`)

  if (own) {
    own['ReadmeQuick']({ target })
    return
  }

  const syntax = loadOptional(ctx$, `./cmp/${t}/Syntax_${t}`)?.Syntax

  Content(`<!-- shared-quick provider=${null == syntax ? 'none' : syntax.lang} -->
SHARED QUICK START for ${t}: ${null == syntax ? '(no syntax provider)' :
      syntax.call('client', 'Entity', '')}

`)
})


export {
  ReadmeQuick
}
