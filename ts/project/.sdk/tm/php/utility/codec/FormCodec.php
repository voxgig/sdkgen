<?php
declare(strict_types=1);

// ProjectName SDK utility: form codec

require_once __DIR__ . '/../Binary.php';

class ProjectNameFormCodec
{
    public const MEDIA = 'application/x-www-form-urlencoded';

    // application/x-www-form-urlencoded byte serialisation: alphanumerics
    // and `*-._` as they are, a space as `+`, every other byte as %HH.
    public static function escape(string $bytes): string
    {
        $out = '';
        $n = strlen($bytes);
        for ($i = 0; $i < $n; $i++) {
            $c = $bytes[$i];
            $b = ord($c);
            if ((0x30 <= $b && $b <= 0x39) || (0x41 <= $b && $b <= 0x5a) || (0x61 <= $b && $b <= 0x7a) ||
                0x2a === $b || 0x2d === $b || 0x2e === $b || 0x5f === $b) {
                $out .= $c;
            } elseif (0x20 === $b) {
                $out .= '+';
            } else {
                $out .= sprintf('%%%02X', $b);
            }
        }
        return $out;
    }

    private static function value(ProjectNameContext $ctx, string $name, mixed $value): string|ProjectNameError
    {
        $content = ProjectNameBinaryUtility::isSource($value) ? $value->data : $value;
        if (ProjectNameBinaryUtility::isStream($content)) {
            return $ctx->make_error('binary_source_refused', "The form field \"{$name}\" holds a Blob or a " .
                'stream, which a form body cannot carry: pass its bytes.');
        }
        return ProjectNameBinaryUtility::toBytes($content);
    }

    public static function encode(ProjectNameContext $ctx, mixed $data, array $lifted): array|ProjectNameError
    {
        $body = \Voxgig\Struct\Struct::getprop($ctx->point, 'body');
        $pairs = [];
        foreach (ProjectNameBinaryUtility::bodyItems($body, $data, $lifted) as $item) {
            $value = self::value($ctx, $item['name'], $item['value']);
            if ($value instanceof ProjectNameError) {
                return $value;
            }
            $pairs[] = self::escape($item['name']) . '=' . self::escape($value);
        }
        $media = \Voxgig\Struct\Struct::getprop($body, 'media');
        return ['type' => is_string($media) && '' !== $media ? $media : self::MEDIA, 'body' => implode('&', $pairs)];
    }
}
