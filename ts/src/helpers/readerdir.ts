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


export {
  envLocalAt,
}
