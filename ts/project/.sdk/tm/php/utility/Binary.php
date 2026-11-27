<?php
declare(strict_types=1);

// ProjectName SDK utility: binary

require_once __DIR__ . '/struct/Struct.php';
require_once __DIR__ . '/Media.php';

// File content a caller hands the SDK, held as given. A PHP string is bytes
// already, so text is sent as the bytes it holds: nothing here reads a path.
class ProjectNameBinarySource implements \JsonSerializable
{
    public string $kind = 'bytes';
    public string $data;
    public ?string $name = null;
    public ?string $type = null;

    public function __construct(string $data, array $opts = [])
    {
        $this->data = $data;
        if (is_string($opts['name'] ?? null)) {
            $this->name = $opts['name'];
        }
        if (is_string($opts['type'] ?? null) && '' !== $opts['type']) {
            $this->type = $opts['type'];
        }
    }

    public function size(): int
    {
        return strlen($this->data);
    }

    // A source serialised anywhere is described, never copied.
    public function jsonSerialize(): array
    {
        $desc = ['binary$' => 'bytes', 'size' => $this->size()];
        if (null !== $this->type) {
            $desc['type'] = $this->type;
        }
        return $desc;
    }

    public function __debugInfo(): array
    {
        return $this->jsonSerialize();
    }
}


// The one source core builds. PHP has no platform blob: bytes and text are
// both strings, and any other value is sent as its text.
class ProjectNameBinary
{
    public static function bytes(mixed $data, array $opts = []): ProjectNameBinarySource
    {
        return new ProjectNameBinarySource(ProjectNameBinaryUtility::toBytes($data), $opts);
    }
}


class ProjectNameBinaryUtility
{
    private const MAXDEPTH = 32;

    public static function isSource(mixed $value): bool
    {
        return $value instanceof ProjectNameBinarySource;
    }

    public static function isStream(mixed $value): bool
    {
        return is_resource($value);
    }

    public static function toBytes(mixed $value): string
    {
        return is_string($value) ? $value : self::itemText($value);
    }

    // The path of the first source in a value, or null.
    private static function sourceAt(mixed $value, string $path, int $depth, array &$seen): ?string
    {
        if (self::MAXDEPTH <= $depth) {
            return null;
        }
        if (self::isSource($value)) {
            return $path;
        }
        if ($value instanceof \stdClass) {
            $id = spl_object_id($value);
            if (in_array($id, $seen, true)) {
                return null;
            }
            $seen[] = $id;
            $value = get_object_vars($value);
        }
        if (!is_array($value)) {
            return null;
        }
        foreach ($value as $key => $item) {
            $found = self::sourceAt($item, '' === $path ? (string)$key : $path . '.' . $key,
                $depth + 1, $seen);
            if (null !== $found) {
                return $found;
            }
        }
        return null;
    }

    // The data keys whose values are file content: a multipart or form
    // body's binary fields, and the whole of a raw body.
    public static function binaryNames(mixed $point): array
    {
        $body = \Voxgig\Struct\Struct::getprop($point, 'body');
        $kind = \Voxgig\Struct\Struct::getprop($body, 'kind');
        if ('raw' === $kind) {
            return [ProjectNameMedia::RAW_BODY];
        }
        if ('multipart' !== $kind && 'form' !== $kind) {
            return [];
        }
        $names = [];
        $fields = \Voxgig\Struct\Struct::getprop($body, 'fields');
        foreach (is_array($fields) ? $fields : [] as $field) {
            if (is_array($field) && true === ($field['binary'] ?? null) && is_string($field['name'] ?? null)) {
                $names[] = $field['name'];
            }
        }
        return $names;
    }

    // Moves the values of binary fields out of the request data, before a
    // hook, a transform, validation or clean reads it. A source anywhere
    // else is refused. Answers the refusal, or null.
    public static function liftSources(ProjectNameContext $ctx): ?ProjectNameError
    {
        if (null !== $ctx->sources) {
            return null;
        }

        $lifted = [];
        $reqdata = $ctx->reqdata;
        foreach (self::binaryNames($ctx->point) as $name) {
            if (array_key_exists($name, $reqdata)) {
                $lifted[$name] = $reqdata[$name];
                unset($reqdata[$name]);
            }
        }

        $seen = [];
        $stray = self::sourceAt($reqdata, '', 0, $seen) ?? self::sourceAt($ctx->reqmatch, '', 0, $seen);
        if (null !== $stray) {
            return $ctx->make_error('binary_source_refused', "A binary source was passed in \"{$stray}\", " .
                'which is not a field the operation declares binary.');
        }

        $ctx->reqdata = $reqdata;
        $ctx->sources = $lifted;
        return null;
    }

    // A response the model declares to be bytes is read only through the
    // entity's binary handle, never into its data.
    public static function bytesRefused(ProjectNameContext $ctx): ?ProjectNameError
    {
        $response = \Voxgig\Struct\Struct::getprop($ctx->point, 'response');
        if ('raw' !== \Voxgig\Struct\Struct::getprop($response, 'kind') ||
            true !== \Voxgig\Struct\Struct::getprop($response, 'binary') || null !== $ctx->ctrl->transfer) {
            return null;
        }
        $action = \Voxgig\Struct\Struct::getprop(\Voxgig\Struct\Struct::getprop($ctx->point, 'select'), '$action');
        $call = is_string($action) ? "binary('{$action}')" : 'binary()';
        return $ctx->make_error('binary_sink_required', "Operation \"{$ctx->op->name}\" on entity " .
            "\"{$ctx->op->entity}\" answers bytes, which never enter the entity's data: read them with " .
            "\$entity->{$call}->bytes().");
    }

    // A plain value as the text of a form pair or a multipart part.
    public static function itemText(mixed $value): string
    {
        if (is_string($value)) {
            return $value;
        }
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }
        if (is_float($value) && is_finite($value) && floor($value) === $value && abs($value) < 1e15) {
            return (string)(int)$value;
        }
        if (is_int($value) || is_float($value)) {
            return (string)$value;
        }
        return (string)json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    // The values a form or multipart body carries, in wire order: the fields
    // the model declares, in its order, then any other key of the data, in
    // code point order. A list repeats its field per item, or is one value
    // joined by the field's `join`; an absent or null value sends nothing.
    public static function bodyItems(mixed $body, mixed $data, array $lifted): array
    {
        $fields = [];
        $raw = \Voxgig\Struct\Struct::getprop($body, 'fields');
        foreach (is_array($raw) ? $raw : [] as $field) {
            if (is_array($field) && is_string($field['name'] ?? null)) {
                $fields[$field['name']] = $field;
            }
        }
        $plain = is_array($data) && !array_is_list($data) ? $data : [];

        $names = [];
        foreach (array_keys($fields) as $name) {
            if (array_key_exists($name, $plain) || array_key_exists($name, $lifted)) {
                $names[] = (string)$name;
            }
        }
        $rest = [];
        foreach (array_keys($plain) as $key) {
            if (!array_key_exists((string)$key, $fields)) {
                $rest[] = (string)$key;
            }
        }
        sort($rest, SORT_STRING);

        $items = [];
        foreach (array_merge($names, $rest) as $name) {
            $field = $fields[$name] ?? ['name' => $name];
            $value = array_key_exists($name, $lifted) ? $lifted[$name] : $plain[$name];
            $file = true === ($field['binary'] ?? null);
            if (null === $value) {
                continue;
            }
            if (is_array($value) && array_is_list($value)) {
                $present = array_values(array_filter($value, fn (mixed $item): bool => null !== $item));
                if (!$file && is_string($field['join'] ?? null)) {
                    $items[] = ['name' => $name, 'field' => $field, 'binary' => $file,
                        'value' => implode($field['join'], array_map([self::class, 'itemText'], $present))];
                } else {
                    foreach ($present as $item) {
                        $items[] = ['name' => $name, 'field' => $field, 'value' => $item, 'binary' => $file];
                    }
                }
            } else {
                $items[] = ['name' => $name, 'field' => $field, 'value' => $value, 'binary' => $file];
            }
        }
        return $items;
    }
}
