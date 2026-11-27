<?php
declare(strict_types=1);

// ProjectName SDK utility: binary handle

require_once __DIR__ . '/../Media.php';
require_once __DIR__ . '/../../core/Error.php';

// An entity's named bytes. Each call is one run of the entity's own
// operation on the slot's point; in core only whole, in-memory bodies move.
// A slot, as the entity component derived it from the model, is the action
// whose points move its bytes ('' for the entity's own) and the operations
// that read and write them: `['action', 'read'?, 'write'?]`.
class ProjectNameBinaryHandle
{
    private mixed $entity;
    private string $slot;
    private ?array $def;

    public function __construct(mixed $entity, array $slots, ?string $slot = null)
    {
        $this->entity = $entity;
        $this->slot = $slot ?? '';
        $this->def = $slots[$this->slot] ?? null;
    }

    public function name(): string
    {
        return $this->slot;
    }

    // The whole body, within maxBuffer. The transfer is an object so the
    // operation's raw read can hand the bytes back through it.
    public function bytes(?array $opts = null, ?array $ctrl = null): string
    {
        if (null !== ($opts['range'] ?? null)) {
            throw $this->inactive('read a range');
        }
        $def = $this->direction('read');
        $transfer = new \ArrayObject(['slot' => $this->slot, 'direction' => 'read']);
        $this->entity->{$def['read']}($this->select($def), array_merge($ctrl ?? [], ['transfer' => $transfer]));
        return (string)($transfer['bytes'] ?? '');
    }

    // Sends in-memory content as the slot's body; answers the entity.
    public function put(mixed $source, ?array $ctrl = null): mixed
    {
        $def = $this->direction('write');
        $transfer = new \ArrayObject(['slot' => $this->slot, 'direction' => 'write']);
        $this->entity->{$def['write']}(
            array_merge($this->select($def), [ProjectNameMedia::RAW_BODY => $source]),
            array_merge($ctrl ?? [], ['transfer' => $transfer]));
        return $this->entity;
    }

    public function save(mixed ...$args): never
    {
        throw $this->inactive('save');
    }

    public function stream(mixed ...$args): never
    {
        throw $this->inactive('stream');
    }

    public function open(mixed ...$args): never
    {
        throw $this->inactive('open');
    }

    private function select(array $def): array
    {
        return '' === (string)($def['action'] ?? '') ? [] : ['$action' => $def['action']];
    }

    private function direction(string $way): array
    {
        $entity = $this->entity->get_name();
        if (null === $this->def) {
            throw new ProjectNameError('binary_slot_unknown',
                "Entity \"{$entity}\" has no binary slot \"{$this->slot}\".");
        }
        if (null === ($this->def[$way] ?? null)) {
            throw new ProjectNameError('binary_slot_direction', "The binary slot \"{$this->slot}\" of entity " .
                "\"{$entity}\" cannot be " . ('read' === $way ? 'read' : 'written') . '.');
        }
        return $this->def;
    }

    private function inactive(string $what): ProjectNameError
    {
        return new ProjectNameError('binary_feature_inactive', "The binary slot \"{$this->slot}\" of entity " .
            "\"{$this->entity->get_name()}\" cannot {$what} without the binary feature; in core it answers " .
            'bytes() and put().');
    }
}
