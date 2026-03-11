

import { cmp, Content } from '@voxgig/sdkgen'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$

  Content(`
// ${entity.Name} creates a new ${entity.Name} entity.
func (s *${model.const.Name}SDK) ${entity.Name}(entopts ...map[string]any) *${entity.Name}Entity {
	var eo map[string]any
	if len(entopts) > 0 {
		eo = entopts[0]
	}
	return New${entity.Name}Entity(s, eo)
}

`)

})


export {
  MainEntity
}
