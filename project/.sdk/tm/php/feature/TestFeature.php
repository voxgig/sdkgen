<?php
declare(strict_types=1);

// ProjectName SDK test feature

require_once __DIR__ . '/BaseFeature.php';

class ProjectNameTestFeature extends ProjectNameBaseFeature
{
    private mixed $client;
    private ?array $options;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'test';
        $this->active = true;
        $this->client = null;
        $this->options = null;
    }

    public function init(ProjectNameContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;

        $entity = \Voxgig\Struct\Struct::getprop($options, 'entity');
        if (!is_array($entity)) {
            $entity = [];
        }

        $this->client->mode = 'test';

        // Ensure entity ids are correct.
        \Voxgig\Struct\Struct::walk($entity, function ($key, $val, $parent, $path) {
            if (count($path) === 2 && is_array($val) && $key !== null) {
                $val['id'] = $key;
            }
            return $val;
        });

        $test_self = $this;

        $test_fetcher = function (ProjectNameContext $fctx, string $_fullurl, array $_fetchdef) use ($entity, $test_self): array {
            $respond = function (int $status, mixed $data, ?array $extra): array {
                $out = [
                    'status' => $status,
                    'statusText' => 'OK',
                    'json' => function () use ($data) { return $data; },
                    'body' => 'not-used',
                ];
                if ($extra) {
                    foreach ($extra as $k => $v) {
                        $out[$k] = $v;
                    }
                }
                return [$out, null];
            };

            $op = $fctx->op;
            $entmap = \Voxgig\Struct\Struct::getprop($entity, $op->entity);
            if (!is_array($entmap)) {
                $entmap = [];
            }

            if ($op->name === 'load') {
                $args = $test_self->build_args($fctx, $op, $fctx->reqmatch);
                $found = \Voxgig\Struct\Struct::select($entmap, $args);
                $ent = \Voxgig\Struct\Struct::getelem($found, 0);
                if (!$ent) {
                    return $respond(404, null, ['statusText' => 'Not found']);
                }
                \Voxgig\Struct\Struct::delprop($ent, '$KEY');
                $out = \Voxgig\Struct\Struct::clone($ent);
                return $respond(200, $out, null);

            } elseif ($op->name === 'list') {
                $args = $test_self->build_args($fctx, $op, $fctx->reqmatch);
                $found = \Voxgig\Struct\Struct::select($entmap, $args);
                if (!$found) {
                    return $respond(404, null, ['statusText' => 'Not found']);
                }
                if (is_array($found)) {
                    foreach ($found as $item) {
                        \Voxgig\Struct\Struct::delprop($item, '$KEY');
                    }
                }
                $out = \Voxgig\Struct\Struct::clone($found);
                return $respond(200, $out, null);

            } elseif ($op->name === 'update') {
                $args = $test_self->build_args($fctx, $op, $fctx->reqdata);
                $found = \Voxgig\Struct\Struct::select($entmap, $args);
                $ent = \Voxgig\Struct\Struct::getelem($found, 0);
                if (!$ent) {
                    return $respond(404, null, ['statusText' => 'Not found']);
                }
                if (is_array($ent) && $fctx->reqdata) {
                    foreach ($fctx->reqdata as $k => $v) {
                        $ent[$k] = $v;
                    }
                }
                \Voxgig\Struct\Struct::delprop($ent, '$KEY');
                $out = \Voxgig\Struct\Struct::clone($ent);
                return $respond(200, $out, null);

            } elseif ($op->name === 'remove') {
                $args = $test_self->build_args($fctx, $op, $fctx->reqmatch);
                $found = \Voxgig\Struct\Struct::select($entmap, $args);
                $ent = \Voxgig\Struct\Struct::getelem($found, 0);
                if (!$ent) {
                    return $respond(404, null, ['statusText' => 'Not found']);
                }
                if (is_array($ent)) {
                    $id = \Voxgig\Struct\Struct::getprop($ent, 'id');
                    \Voxgig\Struct\Struct::delprop($entmap, $id);
                }
                return $respond(200, null, null);

            } elseif ($op->name === 'create') {
                $test_self->build_args($fctx, $op, $fctx->reqdata);
                $id = ($fctx->utility->param)($fctx, 'id');
                if ($id === null) {
                    $id = sprintf('%04x%04x%04x%04x', random_int(0, 0xFFFF), random_int(0, 0xFFFF), random_int(0, 0xFFFF), random_int(0, 0xFFFF));
                }

                $ent = \Voxgig\Struct\Struct::clone($fctx->reqdata);
                if (is_array($ent)) {
                    $ent['id'] = $id;
                    if (is_string($id)) {
                        $entmap[$id] = $ent;
                    }
                    \Voxgig\Struct\Struct::delprop($ent, '$KEY');
                    $out = \Voxgig\Struct\Struct::clone($ent);
                    return $respond(200, $out, null);
                }
                return $respond(200, $ent, null);

            } else {
                return $respond(404, null, ['statusText' => 'Unknown operation']);
            }
        };

        $ctx->utility->fetcher = $test_fetcher;
    }

    public function build_args(ProjectNameContext $ctx, ProjectNameOperation $op, mixed $args): array
    {
        $opname = $op->name;
        $entname = (is_object($ctx->entity) && method_exists($ctx->entity, 'get_name'))
            ? $ctx->entity->get_name()
            : '_';
        $points = \Voxgig\Struct\Struct::getpath($ctx->config, "entity.{$entname}.op.{$opname}.points");
        $point = \Voxgig\Struct\Struct::getelem($points, -1);

        $params_path = \Voxgig\Struct\Struct::getpath($point, 'args.params');
        $reqd_params = \Voxgig\Struct\Struct::select($params_path, ['reqd' => true]);
        $reqd = \Voxgig\Struct\Struct::transform($reqd_params, ['`$EACH`', '', '`$KEY.name`']);

        $qand = [];
        $q = ['`$AND`' => &$qand];

        if ($args) {
            $keys = \Voxgig\Struct\Struct::keysof($args);
            if ($keys) {
                foreach ($keys as $key) {
                    $is_id = ($key === 'id');
                    $selected = \Voxgig\Struct\Struct::select($reqd, $key);
                    $is_reqd = !\Voxgig\Struct\Struct::isempty($selected);

                    if ($is_id || $is_reqd) {
                        $v = ($ctx->utility->param)($ctx, $key);
                        $ka = $op->alias_map ? \Voxgig\Struct\Struct::getprop($op->alias_map, $key) : null;

                        $qor = [[$key => $v]];
                        if (is_string($ka)) {
                            $qor[] = [$ka => $v];
                        }

                        $qand[] = ['`$OR`' => $qor];
                    }
                }
            }
        }

        if ($ctx->ctrl->explain) {
            $ctx->ctrl->explain['test'] = ['query' => $q];
        }

        return $q;
    }
}
