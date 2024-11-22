
import { cmp, File, Content, Folder } from '@voxgig/sdkgen'

import { Quick } from './Quick_js'
import { TestMain } from './TestMain_js'
import { TestAccept } from './TestAccept_js'


const Test = cmp(function Test(props: any) {
  const { target } = props

  Folder({ name: 'test' }, () => {
    Quick({ target })
    TestMain({ target })
    Folder({ name: 'accept' }, () => {
      TestAccept({ target })
    })
  })
})


export {
  Test
}
