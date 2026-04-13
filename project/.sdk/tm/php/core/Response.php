<?php
declare(strict_types=1);

// ProjectName SDK response

class ProjectNameResponse
{
    public int $status;
    public string $status_text;
    public mixed $headers;
    public mixed $json_func;
    public mixed $body;
    public mixed $err;

    public function __construct(array $resmap = [])
    {
        $s = \Voxgig\Struct\Struct::getprop($resmap, 'status');
        $this->status = is_numeric($s) ? (int)$s : -1;
        $st = \Voxgig\Struct\Struct::getprop($resmap, 'statusText');
        $this->status_text = is_string($st) ? $st : '';
        $this->headers = \Voxgig\Struct\Struct::getprop($resmap, 'headers');
        $jf = \Voxgig\Struct\Struct::getprop($resmap, 'json');
        $this->json_func = is_callable($jf) ? $jf : null;
        $this->body = \Voxgig\Struct\Struct::getprop($resmap, 'body');
        $this->err = \Voxgig\Struct\Struct::getprop($resmap, 'err');
    }
}
