import * as Jostraca from 'jostraca'


// The node meta key naming the component that made the node, by which
// helpers/generated traces a generated file to the component that produced it.
const COMPONENT = 'cmp'


// The components that write one target's own files.
const PER_TARGET = ['Main', 'Entity', 'Feature', 'Readme', 'Test', 'AgentGuide']


// jostraca's cmp, labelling each node it makes with the component's name. A
// target a run override relocates writes nothing in the in-tree pass.
const cmp: typeof Jostraca.cmp = ((component: any) => {
  const labelled = (props: any, children?: any) => {
    if (null != props?.ctx$?.node?.meta) {
      props.ctx$.node.meta[COMPONENT] = component.name
    }
    if (PER_TARGET.includes(component.name) &&
      true === props?.ctx$?.meta?.relocated?.includes(props?.target?.name)) {
      return
    }
    return component(props, children)
  }
  Object.defineProperty(labelled, 'name', { value: component.name })
  return Jostraca.cmp(labelled)
}) as typeof Jostraca.cmp


export {
  COMPONENT,
  cmp,
}
