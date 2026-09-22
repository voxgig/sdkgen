from demo_sdk.core.context import DemoContext


root = DemoContext({"config": {}})
entity = DemoContext({}, root)
first = DemoContext({"opname": "list"}, entity)
first.ctrl.paging = {"cursor": "first"}
second = DemoContext({"opname": "list"}, entity)
assert first.ctrl is not second.ctrl
assert root.ctrl.paging is None
assert second.ctrl.paging is None
assert DemoContext({}, first).ctrl is first.ctrl
paging = {"cursor": "explicit"}
explicit = DemoContext({"opname": "list", "ctrl": {"paging": paging}}, entity)
assert explicit.ctrl.paging is paging
print("context: isolated defaults; explicit and nested controls preserved")
