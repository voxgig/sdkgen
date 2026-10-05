
import { KIT } from '@voxgig/apidef'


// The prose a project writes under `main.kit.text`, over `main.kit.info`,
// where the spec and older projects put it. An empty slot falls through.
function modelText(model: any): any {
  const info = model?.main?.[KIT]?.info || {}
  const text = model?.main?.[KIT]?.text || {}

  const out: any = { ...info, entity_desc: { ...(info.entity_desc || {}) } }
  for (const [slot, value] of Object.entries(text)) {
    if ('entity_desc' === slot) {
      for (const [entity, desc] of Object.entries(value || {})) {
        if (given(desc)) out.entity_desc[entity] = desc
      }
    }
    else if (given(value)) {
      out[slot] = value
    }
  }
  return out
}


function given(value: any): boolean {
  return null != value && '' !== value
}


export {
  modelText,
}
