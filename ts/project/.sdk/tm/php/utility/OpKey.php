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

    // The key a call is filed under where a consumer reads it: the first key,
    // with the action cleaned as the `action` field of a record, so a
    // sensitive key name masks it as well as a registered value.
    public static function fileKey(ProjectNameContext $ctx): string
    {
        $keys = self::keys($ctx);
        $action = self::action($ctx);
        if (null === $action) {
            return $keys[0];
        }
        $clean = $ctx->utility->clean ?? null;
        $out = is_callable($clean) ? $clean($ctx, ['action' => $action]) : null;
        $cleaned = is_array($out) ? ($out['action'] ?? null) : null;
        return $keys[1] . ':' . (is_string($cleaned) ? $cleaned : $action);
    }
}
