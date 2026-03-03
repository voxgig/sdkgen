
/* Utility functions.
 *
 * Many of these functions expect the operation context as the first argument, and
 * assume the following top level properties of the context:
 *   * client: SDK client instance
 *   * op: operation definition
 *   * utility: map of these utility functions
 *   * entity?: SDK entity instance
 *   * spec?: request specification
 *   * response?: unprocessed response
 *   * result?: processed result built from response
 *   * config?: SDK builtin configuration
 *
 */


import { addfeature } from './AddfeatureUtility'
import { prepareAuth } from './PrepareAuthUtility'
import { prepareBody } from './PrepareBodyUtility'
import { clean } from './CleanUtility'
import { done } from './DoneUtility'
import { error } from './ErrorUtility'
import { featureHook } from './FeatureHookUtility'
import { fetcher } from './FetcherUtility'
import { findparam } from './FindparamUtility'
import { fullurl } from './FullurlUtility'
import { prepareHeaders } from './PrepareHeadersUtility'
import { initfeature } from './InitfeatureUtility'
import { makeContext } from './MakeContextUtility'
import { makeOperation } from './OperationUtility'
import { prepareMethod } from './PrepareMethodUtility'
import { options } from './OptionsUtility'
import { prepareParams } from './PrepareParamsUtility'
import { preparePath } from './PreparePathUtility'
import { prepareQuery } from './PrepareQueryUtility'
import { transformRequest } from './TransformRequestUtility'
import { request } from './RequestUtility'
import { resbasic } from './ResbasicUtility'
import { resbody } from './ResbodyUtility'
import { transformResponse } from './TransformResponseUtility'
import { resheaders } from './ResheadersUtility'
import { response } from './ResponseUtility'
import { result } from './ResultUtility'
import { selection } from './SelectionUtility'
import { spec } from './SpecUtility'

import { StructUtility } from './StructUtility'


class Utility {

  addfeature = addfeature
  prepareAuth = prepareAuth
  prepareBody = prepareBody
  clean = clean
  done = done
  error = error
  featureHook = featureHook
  fetcher = fetcher
  findparam = findparam
  fullurl = fullurl
  prepareHeaders = prepareHeaders
  initfeature = initfeature
  makeContext = makeContext
  makeOperation = makeOperation
  prepareMethod = prepareMethod
  options = options
  prepareParams = prepareParams
  preparePath = preparePath
  prepareQuery = prepareQuery
  transformRequest = transformRequest
  request = request
  resbasic = resbasic
  resbody = resbody
  transformResponse = transformResponse
  resheaders = resheaders
  response = response
  result = result
  selection = selection
  spec = spec

  struct = new StructUtility()
}


export {
  Utility
}

