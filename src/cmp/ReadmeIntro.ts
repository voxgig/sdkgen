
import { cmp, select, Code } from 'jostraca'


const ReadmeIntro = cmp(function ReadmeIntro(props: any) {
  const { ctx$: { model } } = props

  Code(`
## Introduction

${model.main.def.desc}

`)



})




export {
  ReadmeIntro
}
