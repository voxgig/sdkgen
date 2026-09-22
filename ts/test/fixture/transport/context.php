<?php
require_once __DIR__ . '/utility/struct/Struct.php';
require_once __DIR__ . '/core/Context.php';

$root = new DemoContext(['config' => []]);
$entity = new DemoContext([], $root);
$first = new DemoContext(['opname' => 'list'], $entity);
$first->ctrl->paging = ['cursor' => 'first'];
$second = new DemoContext(['opname' => 'list'], $entity);
if ($first->ctrl === $second->ctrl) throw new Exception('shared operation control');
if ($root->ctrl->paging !== null) throw new Exception('root paging changed');
if ($second->ctrl->paging !== null) throw new Exception('paging leaked');
if ((new DemoContext([], $first))->ctrl !== $first->ctrl) throw new Exception('nested control lost');
$explicit = new DemoContext(['opname' => 'list', 'ctrl' => ['paging' => ['cursor' => 'explicit']]], $entity);
if ($explicit->ctrl->paging['cursor'] !== 'explicit') throw new Exception('explicit paging lost');
echo "context: isolated defaults; explicit and nested controls preserved\n";
