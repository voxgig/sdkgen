
import Fs from 'node:fs'

import type {
  JostracaResult
} from 'jostraca'


type FsUtil = typeof Fs


type ActionContext = {
  fs: () => FsUtil,
  log: any,
  folder: string,
  model: any,
  tree: any,
  opts: any,
  jostraca: any
}


type ActionResult = {
  jres: JostracaResult
}



export type {
  ActionContext,
  ActionResult,
}

