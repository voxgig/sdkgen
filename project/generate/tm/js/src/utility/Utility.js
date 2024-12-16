
const { auth } = require('./AuthUtility')
const { empty } = require('./EmptyUtility')
const { error } = require('./ErrorUtility')
const { escre } = require('./EscreUtility')
const { escurl } = require('./EscurlUtility')
const { extract } = require('./ExtractUtility')
const { fetch } = require('./FetchUtility')
const { fullurl } = require('./FullurlUtility')
const { headers } = require('./HeadersUtility')
const { joinurl } = require('./JoinurlUtility')
const { method } = require('./MethodUtility')
const { operator } = require('./OperatorUtility')
const { options } = require('./OptionsUtility')
const { params } = require('./ParamsUtility')
const { query } = require('./QueryUtility')
const { resbasic } = require('./ResbasicUtility')
const { resbody } = require('./ResbodyUtility')
const { resheaders } = require('./ResheadersUtility')
const { response } = require('./ResponseUtility')
const { spec } = require('./SpecUtility')


const Utility = {
  auth,
  empty,
  error,
  escre,
  escurl,
  extract,
  fetch,
  fullurl,
  headers,
  joinurl,
  method,
  operator,
  options,
  params,
  query,
  resbasic,
  resbody,
  resheaders,
  response,
  spec,
}


module.exports = {
  Utility
}

