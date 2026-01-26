import Fs from 'node:fs';
import type { JostracaResult } from 'jostraca';
import { KIT, getModelPath } from '@voxgig/apidef';
type FsUtil = typeof Fs;
type ActionContext = {
    fs: () => FsUtil;
    log: any;
    folder: string;
    model: any;
    url: string;
    opts: any;
    jostraca: any;
};
type ActionResult = {
    jres: JostracaResult;
};
export { KIT, getModelPath, };
export type { ActionContext, ActionResult, };
