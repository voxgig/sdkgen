
import { cmp, select, Content } from 'jostraca'


const ReadmeIntro = cmp(function ReadmeIntro(props: any) {
  const { ctx$: { model } } = props

  Content(`
## Introduction

${model.main.def.desc}

`)



})




export {
  ReadmeIntro
}
