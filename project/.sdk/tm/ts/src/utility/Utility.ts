
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


import { featureAdd } from './FeatureAddUtility'
import { prepareAuth } from './PrepareAuthUtility'
import { prepareBody } from './PrepareBodyUtility'
import { clean } from './CleanUtility'
import { done } from './DoneUtility'
import { error } from './ErrorUtility'
import { featureHook } from './FeatureHookUtility'
import { fetcher } from './FetcherUtility'
import { param } from './ParamUtility'
import { makeUrl } from './MakeUrlUtility'
import { prepareHeaders } from './PrepareHeadersUtility'
import { featureInit } from './FeatureInitUtility'
import { makeContext } from './MakeContextUtility'
import { makeOperation } from './OperationUtility'
import { prepareMethod } from './PrepareMethodUtility'
import { makeOptions } from './MakeOptionsUtility'
import { prepareParams } from './PrepareParamsUtility'
import { preparePath } from './PreparePathUtility'
import { prepareQuery } from './PrepareQueryUtility'
import { transformRequest } from './TransformRequestUtility'
import { makeRequest } from './MakeRequestUtility'
import { resultBasic } from './ResultBasicUtility'
import { resultBody } from './ResultBodyUtility'
import { transformResponse } from './TransformResponseUtility'
import { resultHeaders } from './ResultHeadersUtility'
import { makeResponse } from './MakeResponseUtility'
import { makeResult } from './MakeResultUtility'
import { makeSelection } from './MakeSelectionUtility'
import { makeSpec } from './MakeSpecUtility'

import { StructUtility } from './StructUtility'


class Utility {

  featureAdd = featureAdd
  prepareAuth = prepareAuth
  prepareBody = prepareBody
  clean = clean
  done = done
  error = error
  featureHook = featureHook
  fetcher = fetcher
  param = param
  makeUrl = makeUrl
  prepareHeaders = prepareHeaders
  featureInit = featureInit
  makeContext = makeContext
  makeOperation = makeOperation
  prepareMethod = prepareMethod
  makeOptions = makeOptions
  prepareParams = prepareParams
  preparePath = preparePath
  prepareQuery = prepareQuery
  transformRequest = transformRequest
  makeRequest = makeRequest
  resultBasic = resultBasic
  resultBody = resultBody
  transformResponse = transformResponse
  resultHeaders = resultHeaders
  makeResponse = makeResponse
  makeResult = makeResult
  makeSelection = makeSelection
  makeSpec = makeSpec

  struct = new StructUtility()
}


export {
  Utility
}

