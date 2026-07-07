<?php
declare(strict_types=1);

// ProjectName SDK utility: result_headers

class ProjectNameResultHeaders
{
    public static function call(ProjectNameContext $ctx): ?ProjectNameResult
    {
        $response = $ctx->response;
        $result = $ctx->result;
        if ($result) {
            if ($response && is_array($response->headers)) {
                $result->headers = $response->headers;
            } else {
                $result->headers = [];
            }
        }
        return $result;
    }
}
