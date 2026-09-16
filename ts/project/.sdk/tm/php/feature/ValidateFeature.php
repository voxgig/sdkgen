<?php
declare(strict_types=1);

// ProjectName SDK validate feature

require_once __DIR__ . '/BaseFeature.php';
require_once __DIR__ . '/../schema.php';

// Payload validation against the model's own field types. The php port of
// tm/ts/src/feature/validate/ValidateFeature.ts.
//
// The specs are NOT written here and not written in the model either: every
// entity field already carries a canonical type sentinel ($STRING, $INTEGER,
// the $ONE union for an OpenAPI multi-type), which is the same vocabulary
// Struct::validate speaks. The generator maps them once (helpers/canonSpec)
// and emits ProjectNameSchema::entityspec(), so a field whose type changes in
// the API spec changes what this feature enforces with no edit anywhere.
//
// WHAT IS CHECKED
//   outbound (PreSpec)  the payload the caller asked to send, against
//                       spec['op'][opname] - the operation's request shape.
//   inbound  (PreDone)  each record the operation returned, against
//                       spec['data'] - the entity's own field types.
//
// WHAT IS NOT. The model carries no array element types, no nested object
// schemas, no enums, formats or bounds, so this checks the shape the model
// knows and nothing more.
class ProjectNameValidateFeature extends ProjectNameBaseFeature
{
    private mixed $client;
    private array $options;
    private mixed $spec;
    private bool $request;
    private bool $response;
    private string $mode;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'validate';
        $this->active = true;
        $this->client = null;
        $this->options = [];
        $this->spec = null;
        $this->request = true;
        $this->response = false;
        $this->mode = 'throw';
    }

    public function init(ProjectNameContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;
        $this->active = ($options['active'] ?? null) === true;

        // DEFAULTS ARE APPLIED HERE, not by the option spec. The model's
        // config.options documents them and types them; it does not inject
        // them, because each feature entry in the spec is optional and struct
        // fills in nothing through an optional union.
        $this->request = ($options['request'] ?? null) !== false;
        $this->response = ($options['response'] ?? null) === true;

        // FAIL CLOSED. Only the exact string 'report' selects report mode, so
        // a typo (mode: 'thow') still rejects rather than silently turning
        // enforcement off. The option spec rejects the typo outright; this is
        // what happens if it ever does not.
        $this->mode = ($options['mode'] ?? null) === 'report' ? 'report' : 'throw';

        // `strict` is applied ONCE, here, by rebuilding the spec tree without
        // the $OPEN markers - rather than per call, which would clone a spec
        // for every request an SDK ever makes.
        $entityspec = ProjectNameSchema::entityspec();
        $this->spec = ($options['strict'] ?? null) === true
            ? self::_close($entityspec) : $entityspec;
    }

    // Outbound. make_spec short-circuits on a $ctx->out['spec'] that is
    // already set, so assigning the error here rejects the operation before
    // the request is built - the same seam rbac uses one stage earlier.
    public function PreSpec(ProjectNameContext $ctx): mixed
    {
        if (!$this->active || !$this->request) {
            return null;
        }

        $opname = $this->_opname($ctx);
        $espec = $this->_entity_spec($ctx);
        $ops = is_array($espec) ? ($espec['op'] ?? null) : null;
        $opspec = is_array($ops) ? ($ops[$opname] ?? null) : null;

        if ($opspec === null) {
            return null;
        }

        $errs = $this->_check($ctx, $this->_payload($ctx, $opname), $opspec, 'request');
        if (count($errs) === 0 || $this->mode === 'report') {
            return null;
        }

        $entname = $this->_entname($ctx);
        $err = $ctx->make_error('validate_failed',
            "Invalid {$opname} request for entity \"{$entname}\": " . implode('; ', $errs));
        $ctx->out['spec'] = $err;
        return $err;
    }

    // Inbound. PreDone rather than PreResult: the records are extracted from
    // the response body by make_result, which runs between the two, so at
    // PreResult there is nothing to check but the envelope.
    //
    // HOOK ORDER MATTERS HERE, and the default order is not the one you want.
    // PreDone hooks fire in feature ADD order, which defaults to `test` first
    // and then names sorted - and `validate` sorts last, after audit, cost,
    // debug, metrics and telemetry. Those observers therefore record the
    // operation as a success before this hook has looked at it. Activating
    // features as an ORDERED LIST fixes it.
    public function PreDone(ProjectNameContext $ctx): mixed
    {
        if (!$this->active || !$this->response) {
            return null;
        }

        $espec = $this->_entity_spec($ctx);
        if (!is_array($espec)) {
            return null;
        }

        $dataspec = $espec['data'] ?? null;
        if ($dataspec === null) {
            return null;
        }

        $result = $ctx->result ?? null;
        if ($result === null || $result->resdata === null) {
            return null;
        }

        // A list op returns many records and a load returns one; both are
        // checked against the same record spec, because they are the same
        // entity. A php list is an array with sequential integer keys; a
        // record decodes to a map, so array_is_list tells them apart.
        $resdata = $result->resdata;
        $records = (is_array($resdata) && array_is_list($resdata)) ? $resdata : [$resdata];

        $errs = [];
        foreach ($records as $record) {
            if ($record === null) {
                continue;
            }

            // A NON-OBJECT IS A FAILURE, not something to skip. A load that
            // answered 42 where the entity's spec wants a record must not pass
            // this feature silently - struct rejects it with the field it
            // could not find.
            foreach ($this->_check($ctx, self::_unwrap($record), $dataspec, 'response') as $e) {
                $errs[] = $e;
            }
        }

        if (count($errs) === 0 || $this->mode === 'report') {
            return null;
        }

        $entname = $this->_entname($ctx);
        $err = $ctx->make_error('validate_failed',
            "Invalid response for entity \"{$entname}\": " . implode('; ', $errs));

        // BOTH, and `ok` is the load-bearing half: done returns resdata
        // whenever result->ok is true and never looks at err, so setting the
        // error alone would hand the caller the very records that failed the
        // spec.
        $result->ok = false;
        $result->err = $err;

        // AND THE DATA GOES. The load/update paths copy result->resdata into
        // the entity's own state on any non-null value, BEFORE done raises -
        // so rejecting the operation while leaving the records in place would
        // leave the caller holding an entity populated from a payload this
        // feature had just declared invalid.
        $result->resdata = null;

        return $err;
    }

    // The payload an operation is about to send.
    //
    // TWO SLOTS, AND THE OP PICKS. A body op (create/update/patch) carries the
    // caller's argument in reqdata over the entity's data; a match op
    // (load/list/remove) carries it in reqmatch over match. That is what the
    // entity operations pass to make_context and what make_point reads - so
    // reading reqdata for every op would check a load(['id' => ...]) against
    // the entity's STALE stored match and reject it for the id the caller had
    // just supplied.
    private function _payload(ProjectNameContext $ctx, string $opname): array
    {
        $body = in_array($opname, ['create', 'update', 'patch'], true);

        $base = $body ? ($ctx->data ?? null) : ($ctx->match ?? null);
        $req = $body ? ($ctx->reqdata ?? null) : ($ctx->reqmatch ?? null);

        $out = [];
        if (is_array($base)) {
            $out = array_merge($out, $base);
        }
        if (is_array($req)) {
            $out = array_merge($out, $req);
        }

        // `$action` SELECTS A CUSTOM ENDPOINT; it is not a field of the
        // record. make_point reads it off this same argument and the request
        // transformer drops it before the body is built, so a spec built from
        // the API's own fields will never name it - and under `strict` every
        // custom-action call would be rejected for the one key that made it
        // reachable.
        unset($out['$action']);

        return $out;
    }

    private function _entity_spec(ProjectNameContext $ctx): mixed
    {
        $entname = $this->_entname($ctx);

        // The spec decodes WITHOUT the assoc flag so an empty map survives as
        // a map (schema.php's note), so the top level may be a stdClass.
        if (is_array($this->spec)) {
            return $this->spec[$entname] ?? null;
        }
        if ($this->spec instanceof \stdClass) {
            return $this->spec->{$entname} ?? null;
        }
        return null;
    }

    private function _opname(ProjectNameContext $ctx): string
    {
        $op = $ctx->op ?? null;
        $name = $op === null ? null : ($op->name ?? null);
        return is_string($name) ? $name : '';
    }

    private function _entname(ProjectNameContext $ctx): string
    {
        $entity = $ctx->entity ?? null;
        $name = $entity === null ? null : ($entity->name ?? null);
        if (is_string($name) && $name !== '') {
            return $name;
        }

        $op = $ctx->op ?? null;
        $entname = $op === null ? null : ($op->entity ?? null);
        return is_string($entname) ? $entname : '';
    }

    // One validate call. Errors are COLLECTED, never thrown: struct throws on
    // the first failure unless given an errs list, and a caller fixing a
    // payload wants every problem with it, not the first one.
    private function _check(
        ProjectNameContext $ctx, mixed $data, mixed $spec, string $direction
    ): array {
        $errs = [];
        $injdef = (object)['errs' => $errs];

        try {
            \Voxgig\Struct\Struct::validate($data, $spec, $injdef);
        } catch (\Throwable $e) {
            // A spec this port cannot run at all (rather than a payload that
            // fails it) must not take the operation down with it: report it
            // like any other failure and let `mode` decide.
            $errs[] = $e->getMessage();
        }

        // The collector is read back off the injdef, not off the local: php
        // passes the array BY VALUE into the object literal above, so validate
        // fills the wrapper's copy and never touches $errs.
        foreach ((array)($injdef->errs ?? []) as $e) {
            $errs[] = is_string($e) ? $e : (string)$e;
        }

        $errs = array_values(array_unique($errs));

        if (count($errs) > 0) {
            $on_invalid = $this->options['onInvalid'] ?? null;
            if (is_callable($on_invalid)) {
                try {
                    $on_invalid([
                        'entity' => $this->_entname($ctx),
                        'op' => $this->_opname($ctx),
                        'direction' => $direction,
                        'errs' => $errs,
                        'data' => $data,
                    ]);
                } catch (\Throwable $e) {
                    // A reporting callback must not fail the operation.
                }
            }
        }

        return $errs;
    }

    // A RESULT RECORD AS DATA.
    //
    // make_result turns every record of a LIST into an entity instance, so
    // what reaches PreDone for a list is wrappers, not records - and a wrapper
    // checked against a field spec fails on every required field while its
    // actual data goes unchecked. A load returns the record itself, so this
    // handles both.
    private static function _unwrap(mixed $record): mixed
    {
        if (is_object($record) && method_exists($record, 'data')) {
            try {
                $data = $record->data();
            } catch (\Throwable $e) {
                return $record;
            }
            if ($data !== null) {
                return $data;
            }
        }
        return $record;
    }

    // The spec tree with every $OPEN marker removed, so an undeclared key is
    // an error rather than a pass. Rebuilt rather than mutated: the entity
    // spec is shared by every client in the process.
    private static function _close(mixed $node): mixed
    {
        // Built rather than written, so the backticks cannot be lost in an
        // edit.
        $open = chr(96) . '$OPEN' . chr(96);

        if (is_array($node)) {
            if (array_is_list($node)) {
                return array_map(static fn($n) => self::_close($n), $node);
            }
            $out = [];
            foreach ($node as $k => $v) {
                if ($k !== $open) {
                    $out[$k] = self::_close($v);
                }
            }
            return $out;
        }

        if ($node instanceof \stdClass) {
            $out = [];
            foreach (get_object_vars($node) as $k => $v) {
                if ($k !== $open) {
                    $out[$k] = self::_close($v);
                }
            }
            // An empty map must STAY a map: struct tells a map from a list,
            // and php renders both as [].
            return count($out) === 0 ? (object)[] : $out;
        }

        return $node;
    }
}
