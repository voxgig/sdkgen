<?php
declare(strict_types=1);

// ProjectName SDK utility: raw codec

require_once __DIR__ . '/../../schema.php';
require_once __DIR__ . '/../Binary.php';
require_once __DIR__ . '/../Media.php';

class ProjectNameRawCodec
{
    public const DEFAULT_MAX = 16777216;
    private const CHUNK = 65536;

    public static function maxBuffer(ProjectNameContext $ctx): int
    {
        $spec = \Voxgig\Struct\Struct::getprop(ProjectNameSchema::optspec(), 'maxBuffer');
        foreach ([$ctx->options['maxBuffer'] ?? null, $spec] as $val) {
            if (is_numeric($val) && is_finite((float)$val) && 0 <= (float)$val) {
                return (int)floor((float)$val);
            }
        }
        return self::DEFAULT_MAX;
    }

    private static function cancel(mixed $body): void
    {
        if (is_resource($body)) {
            @fclose($body);
        }
    }

    private static function tooLarge(ProjectNameContext $ctx, string $code, int $max, ?int $declared = null): ProjectNameError
    {
        return $ctx->make_error($code, 'response: body ' . (null === $declared ? 'is longer than' :
            "of {$declared} bytes exceeds") . " maxBuffer ({$max} bytes)");
    }

    // Each chunk of a body as it arrives: a string is one chunk, a stream is
    // read in pieces, and a list of strings is its items.
    private static function chunks(mixed $body): iterable
    {
        if (is_string($body)) {
            yield $body;
        } elseif (is_resource($body)) {
            while (!feof($body)) {
                $piece = fread($body, self::CHUNK);
                if (false === $piece || '' === $piece) {
                    break;
                }
                yield $piece;
            }
        } elseif (is_array($body) && array_is_list($body)) {
            foreach ($body as $chunk) {
                yield ProjectNameBinaryUtility::toBytes($chunk);
            }
        } elseif (is_iterable($body)) {
            foreach ($body as $chunk) {
                yield ProjectNameBinaryUtility::toBytes($chunk);
            }
        } else {
            yield ProjectNameBinaryUtility::toBytes($body);
        }
    }

    // The whole body, refused past the bound: by its declared length before
    // a byte is read, else by the count as it arrives. Answers bytes or the refusal.
    public static function readBounded(ProjectNameContext $ctx, ?ProjectNameResponse $response, int $max,
        string $code): string|ProjectNameError
    {
        $body = $response?->body;
        $length = trim(ProjectNameMedia::headerValue($response?->headers, 'content-length'));
        $declared = 1 === preg_match('/^\d+$/D', $length) ? (int)$length : null;

        if (null !== $declared && $max < $declared) {
            self::cancel($body);
            return self::tooLarge($ctx, $code, $max, $declared);
        }

        $out = '';
        if (null === $body) {
            return $out;
        }
        foreach (self::chunks($body) as $chunk) {
            if ($max < strlen($out) + strlen($chunk)) {
                self::cancel($body);
                return self::tooLarge($ctx, $code, $max);
            }
            $out .= $chunk;
        }
        return $out;
    }

    // A raw success body: text into the record under `$body`; bytes only
    // into a binary handle's read, never into the record. A refusal is the
    // result's error.
    public static function read(ProjectNameContext $ctx): void
    {
        $response = $ctx->response;
        $result = $ctx->result;
        $max = self::maxBuffer($ctx);

        if (true === \Voxgig\Struct\Struct::getpath($ctx->point, 'response.binary')) {
            $result->body = null;
            $transfer = $ctx->ctrl->transfer;
            if (null !== $transfer && 'read' === ($transfer['direction'] ?? null)) {
                $bytes = self::readBounded($ctx, $response, $max, 'binary_too_large');
                if ($bytes instanceof ProjectNameError) {
                    $result->err = $bytes;
                    return;
                }
                $ctx->ctrl->transfer['bytes'] = $bytes;
            } else {
                self::cancel($response?->body);
            }
            return;
        }

        $bytes = self::readBounded($ctx, $response, $max, 'response_too_large');
        if ($bytes instanceof ProjectNameError) {
            $result->err = $bytes;
            return;
        }
        $text = function_exists('mb_scrub') ? mb_scrub($bytes, 'UTF-8') : $bytes;
        $result->body = [ProjectNameMedia::RAW_BODY => $text];
    }
}
