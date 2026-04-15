<?php
declare(strict_types=1);

// ProjectName SDK base feature

class ProjectNameBaseFeature
{
    public string $version;
    public string $name;
    public bool $active;

    public function __construct()
    {
        $this->version = '0.0.1';
        $this->name = 'base';
        $this->active = true;
    }

    public function get_version(): string { return $this->version; }
    public function get_name(): string { return $this->name; }
    public function get_active(): bool { return $this->active; }

    public function init(ProjectNameContext $ctx, array $options): void {}
    public function PostConstruct(ProjectNameContext $ctx): void {}
    public function PostConstructEntity(ProjectNameContext $ctx): void {}
    public function SetData(ProjectNameContext $ctx): void {}
    public function GetData(ProjectNameContext $ctx): void {}
    public function GetMatch(ProjectNameContext $ctx): void {}
    public function SetMatch(ProjectNameContext $ctx): void {}
    public function PrePoint(ProjectNameContext $ctx): void {}
    public function PreSpec(ProjectNameContext $ctx): void {}
    public function PreRequest(ProjectNameContext $ctx): void {}
    public function PreResponse(ProjectNameContext $ctx): void {}
    public function PreResult(ProjectNameContext $ctx): void {}
    public function PreDone(ProjectNameContext $ctx): void {}
    public function PreUnexpected(ProjectNameContext $ctx): void {}
}
