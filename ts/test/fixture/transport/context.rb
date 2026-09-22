require_relative 'core/context'

root = DemoContext.new({ 'config' => {} })
entity = DemoContext.new({}, root)
first = DemoContext.new({ 'opname' => 'list' }, entity)
first.ctrl.paging = { 'cursor' => 'first' }
second = DemoContext.new({ 'opname' => 'list' }, entity)
raise 'shared operation control' if first.ctrl.equal?(second.ctrl)
raise 'root paging changed' unless root.ctrl.paging.nil?
raise 'paging leaked' unless second.ctrl.paging.nil?
raise 'nested control lost' unless DemoContext.new({}, first).ctrl.equal?(first.ctrl)
paging = { 'cursor' => 'explicit' }
explicit = DemoContext.new({ 'opname' => 'list', 'ctrl' => { 'paging' => paging } }, entity)
raise 'explicit paging lost' unless explicit.ctrl.paging.equal?(paging)
puts 'context: isolated defaults; explicit and nested controls preserved'
