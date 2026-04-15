# ProjectName SDK utility registration
require_relative '../core/utility_type'
require_relative 'clean'
require_relative 'done'
require_relative 'make_error'
require_relative 'feature_add'
require_relative 'feature_hook'
require_relative 'feature_init'
require_relative 'fetcher'
require_relative 'make_fetch_def'
require_relative 'make_context'
require_relative 'make_options'
require_relative 'make_request'
require_relative 'make_response'
require_relative 'make_result'
require_relative 'make_point'
require_relative 'make_spec'
require_relative 'make_url'
require_relative 'param'
require_relative 'prepare_auth'
require_relative 'prepare_body'
require_relative 'prepare_headers'
require_relative 'prepare_method'
require_relative 'prepare_params'
require_relative 'prepare_path'
require_relative 'prepare_query'
require_relative 'result_basic'
require_relative 'result_body'
require_relative 'result_headers'
require_relative 'transform_request'
require_relative 'transform_response'

ProjectNameUtility.registrar = ->(u) {
  u.clean = ProjectNameUtilities::Clean
  u.done = ProjectNameUtilities::Done
  u.make_error = ProjectNameUtilities::MakeError
  u.feature_add = ProjectNameUtilities::FeatureAdd
  u.feature_hook = ProjectNameUtilities::FeatureHook
  u.feature_init = ProjectNameUtilities::FeatureInit
  u.fetcher = ProjectNameUtilities::Fetcher
  u.make_fetch_def = ProjectNameUtilities::MakeFetchDef
  u.make_context = ProjectNameUtilities::MakeContext
  u.make_options = ProjectNameUtilities::MakeOptions
  u.make_request = ProjectNameUtilities::MakeRequest
  u.make_response = ProjectNameUtilities::MakeResponse
  u.make_result = ProjectNameUtilities::MakeResult
  u.make_point = ProjectNameUtilities::MakePoint
  u.make_spec = ProjectNameUtilities::MakeSpec
  u.make_url = ProjectNameUtilities::MakeUrl
  u.param = ProjectNameUtilities::Param
  u.prepare_auth = ProjectNameUtilities::PrepareAuth
  u.prepare_body = ProjectNameUtilities::PrepareBody
  u.prepare_headers = ProjectNameUtilities::PrepareHeaders
  u.prepare_method = ProjectNameUtilities::PrepareMethod
  u.prepare_params = ProjectNameUtilities::PrepareParams
  u.prepare_path = ProjectNameUtilities::PreparePath
  u.prepare_query = ProjectNameUtilities::PrepareQuery
  u.result_basic = ProjectNameUtilities::ResultBasic
  u.result_body = ProjectNameUtilities::ResultBody
  u.result_headers = ProjectNameUtilities::ResultHeaders
  u.transform_request = ProjectNameUtilities::TransformRequest
  u.transform_response = ProjectNameUtilities::TransformResponse
}
