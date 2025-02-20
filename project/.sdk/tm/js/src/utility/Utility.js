
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

const { auth } = require('./AuthUtility')
const { body } = require('./BodyUtility')
const { done } = require('./DoneUtility')
const { error } = require('./ErrorUtility')
const { findparam } = require('./FindparamUtility')
const { fullurl } = require('./FullurlUtility')
const { headers } = require('./HeadersUtility')
const { method } = require('./MethodUtility')
const { operator } = require('./OperatorUtility')
const { options } = require('./OptionsUtility')
const { params } = require('./ParamsUtility')
const { query } = require('./QueryUtility')
const { reqform } = require('./ReqformUtility')
const { request } = require('./RequestUtility')
const { resbasic } = require('./ResbasicUtility')
const { resbody } = require('./ResbodyUtility')
const { resform } = require('./ResformUtility')
const { resheaders } = require('./ResheadersUtility')
const { response } = require('./ResponseUtility')
const { result } = require('./ResultUtility')
const { spec } = require('./SpecUtility')


const struct = require('./StructUtility')
// const validate = require('./ValidateUtility')

const Utility = {
  auth,
  body,
  done,
  error,
  findparam,
  fullurl,
  headers,
  method,
  operator,
  options,
  params,
  query,
  reqform,
  request,
  resbasic,
  resbody,
  resform,
  resheaders,
  response,
  result,
  spec,

  struct,
  // validate,
}


module.exports = {
  Utility
}

