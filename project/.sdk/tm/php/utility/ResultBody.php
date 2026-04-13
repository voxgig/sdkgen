<?php
declare(strict_types=1);

// ProjectName SDK utility: result_body

class ProjectNameResultBody
{
    public static function call(ProjectNameContext $ctx): ?ProjectNameResult
    {
        $response = $ctx->response;
        $result = $ctx->result;
        if ($result && $response && $response->json_func && $response->body) {
            $result->body = ($response->json_func)();
        }
        return $result;
    }
}
