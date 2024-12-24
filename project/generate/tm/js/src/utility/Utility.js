
const { auth } = require('./AuthUtility')
const { body } = require('./BodyUtility')
const { empty } = require('./EmptyUtility')
const { error } = require('./ErrorUtility')
const { escre } = require('./EscreUtility')
const { escurl } = require('./EscurlUtility')
const { fetch } = require('./FetchUtility')
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


const Utility = {
  auth,
  body,
  empty,
  error,
  escre,
  escurl,
  fetch,
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
  validate,
}


module.exports = {
  Utility
}

