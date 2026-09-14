import { KIT } from '../types'

// Physical kind names and model namespaces are independent.
export function kindCollection(model: any, kind: string, create = false): any {
  const kit = create ? (model.main ??= {})[KIT] ??= {} : model?.main?.[KIT]
  if (kind === 'edition') {
    const doc = create ? kit.doc ??= {} : kit?.doc
    return create ? doc.edition ??= {} : doc?.edition ?? {}
  }
  return create ? kit[kind] ??= {} : kit?.[kind] ?? {}
}
