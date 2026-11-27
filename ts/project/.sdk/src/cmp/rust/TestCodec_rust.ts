import {
  cmp, each, Folder, File, Content,
  codecsUsed, entityClassName, entityCollection, entitySlots,
} from '@voxgig/sdkgen'

import { rustMethodName } from './utility_rust'


const CODEC_OPS = ['load', 'create', 'update', 'patch']


function codecPoints(entity: any): boolean {
  return Object.values(entity.op || {}).some((op: any) =>
    each(op?.points || []).some((pt: any) => false !== pt?.a &&
      (['form', 'multipart', 'raw'].includes(pt?.rb?.kind) || 'raw' === pt?.rs?.kind)))
}


// The entities the shipped codec suite drives, by name. A template cannot
// name an entity in rust, which dispatches statically, so this table is
// generated beside it and only when the model uses a codec.
const TestCodec = cmp(function TestCodec(props: any) {
  const { model } = props.ctx$
  const { target, rustcrate } = props

  const used = codecsUsed(model)
  if (!Object.values(used).some((u) => u)) {
    return
  }

  const coll = entityCollection(model)
  const entities = each(coll).filter((e: any) => false !== e.active && codecPoints(e))
  const Name = model.const.Name

  const arms = entities.map((e: any) => {
    const cls = entityClassName(e, coll)
    const slots = entitySlots(e)
    const only = 1 === slots.length && '' === slots[0].name
    const bin = only ? 'e.binary()' : 'e.binary(slot)'
    const slotrows = slots.map((s: any) =>
      `(${JSON.stringify(s.name)}, ${null != s.read}, ${null != s.write})`).join(', ')
    const handle = `            slots: vec![${slotrows}],
            named: ${!only && 0 < slots.length},
` + (0 === slots.length ? `            bytes: None,
            put: None,
            inactive: None,` : `            bytes: Some(Box::new({
                let e = e.clone();
                move |slot, opts, ctrl| { let _ = slot; ${bin}.bytes(opts, ctrl) }
            })),
            put: Some(Box::new({
                let e = e.clone();
                move |slot, src, ctrl| { let _ = slot; ${bin}.put(src, ctrl).map(|got| Rc::ptr_eq(&got, &e)) }
            })),
            inactive: Some(Box::new({
                let e = e.clone();
                move |slot| { let _ = slot; vec![${bin}.save(), ${bin}.stream(), ${bin}.open()] }
            })),`)
    return `        "${e.name}" => {
            let e: Rc<${rustcrate}::entity::${cls}> = client.${rustMethodName(e.name)}(Value::Noval);
            Some(CodecEntity {
            op: Box::new({
                let e = e.clone();
                move |opname, args, ctrl, opwith| {
                    let got = match opname {
${CODEC_OPS.map((op) => `                        "${op}" => e.${op}_with(args, ctrl, opwith),`).join('\n')}
                        _ => return Err(${Name}Error::new("unsupported_op", opname)),
                    }?;
                    Ok(got.data(None))
                }
            }),
            set: Box::new({
                let e = e.clone();
                move |val| {
                    e.data(Some(&val));
                    e.matchv(Some(&val));
                }
            }),
${handle}
        })
        }`
  })

  Folder({ name: 'codec_entities' }, () => {
    File({ name: 'mod.' + target.ext }, () => {
      Content(`// The entities the codec suite drives, generated per model (see TestCodec_rust).

#![allow(dead_code, unused_imports, unused_variables)]

use std::rc::Rc;

use ${rustcrate}::{BinarySource, Entity, OpWith, ${Name}EntityBase, ${Name}Error, ${Name}SDK, Value};

pub type OpFn = Box<dyn Fn(&str, Value, Value, OpWith) -> Result<Value, ${Name}Error>>;
pub type BytesFn = Box<dyn Fn(&str, Value, Value) -> Result<Vec<u8>, ${Name}Error>>;
pub type PutFn = Box<dyn Fn(&str, BinarySource, Value) -> Result<bool, ${Name}Error>>;
pub type InactiveFn = Box<dyn Fn(&str) -> Vec<Result<(), ${Name}Error>>>;

pub struct CodecEntity {
    pub op: OpFn,
    // Each binary slot: its name, and whether it reads and writes.
    pub slots: Vec<(&'static str, bool, bool)>,
    // Whether binary() takes a slot name.
    pub named: bool,
    pub set: Box<dyn Fn(Value)>,
    pub bytes: Option<BytesFn>,
    pub put: Option<PutFn>,
    pub inactive: Option<InactiveFn>,
}

pub type Client = Rc<${Name}SDK>;

pub fn new_client(options: Value) -> Client {
    ${Name}SDK::new(options).expect("the codec suite's client")
}

pub fn entity(client: &Client, name: &str) -> Option<CodecEntity> {
    match name {
${arms.join('\n')}
        _ => None,
    }
}
`)
    })
  })
})


export {
  TestCodec
}
