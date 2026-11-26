import { fact } from './facts'


// The project directory holds `.env.local`. Out of tree it is the run's path
// back, which an undeclared `sdkrel` leaves to the run.
function envLocalAt(ctx$: any, target: any): string {
  if ('external' !== fact(target, 'place')) {
    return 'at the project root'
  }
  const back = null != ctx$.sdkrelpath ? ctx$.sdkrelpath : fact(target, 'sdkrel')
  return 'in the SDK project that generates this package' +
    ('' === back ? '' : ', `' + back + '/` from this directory')
}


// A target's directory as its own documents name it: its folder, from the root
// of this repository, or `.` where the reader of its README stands in it.
function readerDir(target: any): string {
  return 'folder' === fact(target, 'place') ? fact(target, 'dir') : '.'
}


function cdTarget(target: any): string {
  const dir = readerDir(target)
  return '.' === dir ? '' : 'cd ' + dir + ' && '
}


export {
  cdTarget,
  envLocalAt,
  readerDir,
}
