
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
const { empty } = require('./EmptyUtility')
const { error } = require('./ErrorUtility')
const { escre } = require('./EscreUtility')
const { escurl } = require('./EscurlUtility')
const { fetch } = require('./FetchUtility')
const { findparam } = require('./FindparamUtility')
const { fullurl } = require('./FullurlUtility')
const { headers } = require('./HeadersUtility')
const { inward } = require('./InwardUtility')
const { joinurl } = require('./JoinurlUtility')
const { method } = require('./MethodUtility')
const { operator } = require('./OperatorUtility')
const { options } = require('./OptionsUtility')
const { outward } = require('./outwardUtility')
const { params } = require('./ParamsUtility')
const { query } = require('./QueryUtility')
const { resbasic } = require('./ResbasicUtility')
const { resbody } = require('./ResbodyUtility')
const { resheaders } = require('./ResheadersUtility')
const { response } = require('./ResponseUtility')
const { spec } = require('./SpecUtility')

const validate = require('./ValidateUtility')
const string = require('./StringUtility')


const Utility = {
  auth,
  body,
  empty,
  error,
  escre,
  escurl,
  fetch,
  findparam,
  fullurl,
  headers,
  inward,
  joinurl,
  method,
  operator,
  options,
  outward,
  params,
  query,
  resbasic,
  resbody,
  resheaders,
  response,
  spec,
  string,
  validate,
}


module.exports = {
  Utility
}

