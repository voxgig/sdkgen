
import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import type {
  ModelEntity
} from '@voxgig/apidef'

import { cmp, each, Folder, File, Content } from '@voxgig/sdkgen'

import { zigVarName } from './utility_zig'


// Generated tests. The bulk of behavioural coverage lives in the hand-written
// template suite (test/*.zig, copied verbatim): the struct corpus, the
// pipeline, every feature, and the cross-language gotchas. Here we emit a
// model-driven smoke test per entity that drives the full pipeline
// (point -> spec -> request -> mock -> response -> result) through the
// offline `test` transport.
const Test = cmp(function Test(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  Folder({ name: 'test' }, () => {
    File({ name: 'generated_test.' + target.ext }, () => {

      Content(`// Generated smoke tests (model-driven). Drive each entity through the
// offline test transport and assert a non-error result.

const std = @import("std");
const sdk = @import("sdk");
const h = sdk.h;
const Value = sdk.Value;

fn vnull() Value {
    return Value{ .null = {} };
}

test "sdk_constructs_in_test_mode" {
    const testsdk = sdk.testSdk();
    try std.testing.expect(std.mem.eql(u8, testsdk.mode, "test"));
}
`)

      each(entity, (ent: ModelEntity) => {
        const method = zigVarName(ent.name)
        const ops = ent.op || {}

        if (ops.load) {
          Content(`
test "${method}_load_smoke" {
    const fixture = h.jo(&.{.{ "${ent.name}", h.jo(&.{.{ "t01", h.jo(&.{.{ "id", h.vstr("t01") }}) }}) }});
    const testsdk = sdk.test_sdk(h.jo(&.{.{ "entity", fixture }}), vnull());
    const e = testsdk.${method}(vnull());
    const res = e.load(h.jo(&.{.{ "id", h.vstr("t01") }}), vnull());
    switch (res) {
        .ok => |data| {
            try std.testing.expect(std.mem.eql(u8, h.get_str(data, "id") orelse "", "t01"));
        },
        .err => |er| {
            std.debug.print("${method} load failed: {s}\\n", .{er.msg});
            try std.testing.expect(false);
        },
    }
}
`)
        }

        if (ops.list) {
          Content(`
test "${method}_list_smoke" {
    const fixture = h.jo(&.{.{ "${ent.name}", h.jo(&.{.{ "t01", h.jo(&.{.{ "id", h.vstr("t01") }}) }}) }});
    const testsdk = sdk.test_sdk(h.jo(&.{.{ "entity", fixture }}), vnull());
    const e = testsdk.${method}(vnull());
    const res = e.list(vnull(), vnull());
    try std.testing.expect(res == .ok);
}
`)
        }
      })
    })
  })
})


export {
  Test
}
