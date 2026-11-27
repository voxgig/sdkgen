<?php
declare(strict_types=1);

// ProjectName SDK utility: op_key

class ProjectNameOpKey
{
    // The custom action a call names: `$action` in its own request argument,
    // never in a response.
    public static function action(ProjectNameContext $ctx): ?string
    {
        $req = 'data' === $ctx->op->input ? $ctx->reqdata : $ctx->reqmatch;
        $action = is_array($req) ? ($req['$action'] ?? null) : null;
        return is_string($action) && '' !== $action ? $action : null;
    }

    // The keys an operation is looked up and filed by, most specific first:
    // `<entity>.<op>:<action>`, `<entity>.<op>`, `<op>`, `*`.
    public static function keys(ProjectNameContext $ctx): array
    {
        $name = '' !== $ctx->op->name ? $ctx->op->name : '_';
        $entity = $ctx->op->entity;
        if ('' === $entity) {
            $e = $ctx->entity;
            $entity = is_object($e) && method_exists($e, 'get_name') ? (string)$e->get_name() : '';
        }
        $base = ('' !== $entity ? $entity : '_') . '.' . $name;
        $action = self::action($ctx);
        return null === $action ? [$base, $name, '*'] : [$base . ':' . $action, $base, $name, '*'];
    }
}
