<?php
declare(strict_types=1);

// ProjectName SDK utility registration

require_once __DIR__ . '/../core/UtilityType.php';
require_once __DIR__ . '/Clean.php';
require_once __DIR__ . '/Done.php';
require_once __DIR__ . '/MakeError.php';
require_once __DIR__ . '/FeatureAdd.php';
require_once __DIR__ . '/FeatureHook.php';
require_once __DIR__ . '/FeatureInit.php';
require_once __DIR__ . '/Fetcher.php';
require_once __DIR__ . '/MakeFetchDef.php';
require_once __DIR__ . '/MakeContext.php';
require_once __DIR__ . '/MakeOptions.php';
require_once __DIR__ . '/MakeRequest.php';
require_once __DIR__ . '/MakeResponse.php';
require_once __DIR__ . '/MakeResult.php';
require_once __DIR__ . '/MakePoint.php';
require_once __DIR__ . '/MakeSpec.php';
require_once __DIR__ . '/MakeUrl.php';
require_once __DIR__ . '/Param.php';
require_once __DIR__ . '/PrepareAuth.php';
require_once __DIR__ . '/PrepareBody.php';
require_once __DIR__ . '/PrepareHeaders.php';
require_once __DIR__ . '/PrepareMethod.php';
require_once __DIR__ . '/PrepareParams.php';
require_once __DIR__ . '/PreparePath.php';
require_once __DIR__ . '/PrepareQuery.php';
require_once __DIR__ . '/ResultBasic.php';
require_once __DIR__ . '/ResultBody.php';
require_once __DIR__ . '/ResultHeaders.php';
require_once __DIR__ . '/TransformRequest.php';
require_once __DIR__ . '/TransformResponse.php';

ProjectNameUtility::setRegistrar(function (ProjectNameUtility $u): void {
    $u->clean = [ProjectNameClean::class, 'call'];
    $u->done = [ProjectNameDone::class, 'call'];
    $u->make_error = [ProjectNameMakeError::class, 'call'];
    $u->feature_add = [ProjectNameFeatureAdd::class, 'call'];
    $u->feature_hook = [ProjectNameFeatureHook::class, 'call'];
    $u->feature_init = [ProjectNameFeatureInit::class, 'call'];
    $u->fetcher = [ProjectNameFetcher::class, 'call'];
    $u->make_fetch_def = [ProjectNameMakeFetchDef::class, 'call'];
    $u->make_context = [ProjectNameMakeContext::class, 'call'];
    $u->make_options = [ProjectNameMakeOptions::class, 'call'];
    $u->make_request = [ProjectNameMakeRequest::class, 'call'];
    $u->make_response = [ProjectNameMakeResponse::class, 'call'];
    $u->make_result = [ProjectNameMakeResult::class, 'call'];
    $u->make_point = [ProjectNameMakePoint::class, 'call'];
    $u->make_spec = [ProjectNameMakeSpec::class, 'call'];
    $u->make_url = [ProjectNameMakeUrl::class, 'call'];
    $u->param = [ProjectNameParam::class, 'call'];
    $u->prepare_auth = [ProjectNamePrepareAuth::class, 'call'];
    $u->prepare_body = [ProjectNamePrepareBody::class, 'call'];
    $u->prepare_headers = [ProjectNamePrepareHeaders::class, 'call'];
    $u->prepare_method = [ProjectNamePrepareMethod::class, 'call'];
    $u->prepare_params = [ProjectNamePrepareParams::class, 'call'];
    $u->prepare_path = [ProjectNamePreparePath::class, 'call'];
    $u->prepare_query = [ProjectNamePrepareQuery::class, 'call'];
    $u->result_basic = [ProjectNameResultBasic::class, 'call'];
    $u->result_body = [ProjectNameResultBody::class, 'call'];
    $u->result_headers = [ProjectNameResultHeaders::class, 'call'];
    $u->transform_request = [ProjectNameTransformRequest::class, 'call'];
    $u->transform_response = [ProjectNameTransformResponse::class, 'call'];
});
