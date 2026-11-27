<?php
declare(strict_types=1);

// ProjectName SDK utility: multipart codec

require_once __DIR__ . '/../Binary.php';

class ProjectNameMultipartCodec
{
    public const MEDIA = 'multipart/form-data';
    public const OCTET = 'application/octet-stream';

    public static function boundary(ProjectNameContext $ctx): string
    {
        return bin2hex(random_bytes(16));
    }

    // Inside a quoted header parameter nothing may end the quote or the line.
    public static function quoted(string $text): string
    {
        return strtr($text, ['\\' => '%5C', '"' => '%22', "\r" => '%0D', "\n" => '%0A']);
    }

    // A local path never leaves: only its last segment, and nothing for an empty one.
    public static function baseName(mixed $name): ?string
    {
        if (!is_string($name)) {
            return null;
        }
        $parts = preg_split('/[\\\\\/]/', $name);
        $base = (string)end($parts);
        return '' === $base ? null : $base;
    }

    private static function filePart(ProjectNameContext $ctx, string $name, array $field, mixed $value): array|ProjectNameError
    {
        $content = $value;
        $filename = null;
        $type = null;
        if (ProjectNameBinaryUtility::isSource($value)) {
            $content = $value->data;
            $filename = self::baseName($value->name);
            $type = $value->type;
        }
        if (ProjectNameBinaryUtility::isStream($content)) {
            return $ctx->make_error('binary_feature_inactive', "The multipart field \"{$name}\" holds a " .
                'stream, which needs the binary feature: pass bytes, a Blob or a source.');
        }
        return [
            'name' => $name,
            'filename' => $filename,
            'type' => $type ?? $field['media'] ?? self::OCTET,
            'content' => ProjectNameBinaryUtility::toBytes($content),
        ];
    }

    private static function textPart(string $name, array $field, mixed $value): array
    {
        return ['name' => $name, 'filename' => null, 'type' => $field['media'] ?? null,
            'content' => ProjectNameBinaryUtility::toBytes($value)];
    }

    public static function encode(ProjectNameContext $ctx, mixed $data, array $lifted): array|ProjectNameError
    {
        $body = \Voxgig\Struct\Struct::getprop($ctx->point, 'body');
        $boundary = (string)($ctx->utility->multipart_boundary)($ctx);
        $out = '';

        foreach (ProjectNameBinaryUtility::bodyItems($body, $data, $lifted) as $item) {
            $part = $item['binary']
                ? self::filePart($ctx, $item['name'], $item['field'], $item['value'])
                : self::textPart($item['name'], $item['field'], $item['value']);
            if ($part instanceof ProjectNameError) {
                return $part;
            }
            if (is_string($part['type']) && 1 === preg_match('/[\r\n]/', $part['type'])) {
                return $ctx->make_error('binary_source_refused',
                    "The media type of the multipart field \"{$item['name']}\" contains a line break.");
            }
            $out .= "--{$boundary}\r\nContent-Disposition: form-data; name=\"" . self::quoted($part['name']) . '"' .
                (null === $part['filename'] ? '' : '; filename="' . self::quoted($part['filename']) . '"') . "\r\n" .
                (null === $part['type'] ? '' : "Content-Type: {$part['type']}\r\n") . "\r\n" .
                $part['content'] . "\r\n";
        }
        $out .= "--{$boundary}--\r\n";

        $media = \Voxgig\Struct\Struct::getprop($body, 'media');
        $declared = is_string($media) ? trim(explode(';', $media)[0]) : '';
        return ['type' => ('' === $declared ? self::MEDIA : $declared) . '; boundary=' . $boundary, 'body' => $out];
    }
}
