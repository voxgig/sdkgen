

import { cmp, Content } from '@voxgig/sdkgen'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$

  Content(`
    public function ${entity.Name}($data = null)
    {
        require_once __DIR__ . '/entity/${entity.name}_entity.php';
        return new ${entity.Name}Entity($this, $data);
    }

`)

})


export {
  MainEntity
}
