
import {
  KIT,
  Model,
  ModelEntity,
  getModelPath,
} from '@voxgig/apidef'

import {
  Content,
  File,
  cmp,
} from '@voxgig/sdkgen'


// Emit a per-entity ExUnit test that drives the real op pipeline against the
// `test` feature's in-memory mock, seeded from the scaffolded fixture
// (../.sdk/test/entity/<Name>/<Name>TestData.json -> existing.<entity>).
const TestEntity = cmp(function TestEntity(props: any) {
  const { model }: { model: Model } = props.ctx$
  const target = props.target
  const entity: ModelEntity = props.entity

  const Name = model.const.Name
  const EName = entity.Name
  const ename = entity.name

  const opnames = Object.keys(entity.op || {})
  const hasLoad = opnames.includes('load')
  const hasList = opnames.includes('list')
  const hasCreate = opnames.includes('create')

  const fixture = `../.sdk/test/entity/${ename}/${EName}TestData.json`

  File({ name: ename + '_entity_test.exs' }, () => {

    Content(`# ${EName} entity test (offline, mock transport)

defmodule ${Name}.${EName}EntityTest do
  use ExUnit.Case

  alias Voxgig.Struct, as: S
  alias ${Name}.Helpers, as: H
  alias ${Name}.Json

  defp fixture do
    Json.parse(File.read!(${JSON.stringify(fixture)}))
  end

  defp mk_sdk do
    existing = H.or_(S.getpath(fixture(), "existing"), S.jm([]))
    ${Name}.test(S.jm(["entity", existing]))
  end

  defp first_id do
    existing = H.or_(S.getpath(fixture(), "existing.${ename}"), S.jm([]))
    keys = S.keysof(existing)
    if keys == [], do: nil, else: hd(keys)
  end

  test "should create instance" do
    sdk = ${Name}.test()
    ent = ${Name}.${ename}(sdk)
    assert ent != nil
  end
`)

    if (hasList) {
      Content(`
  test "should list records" do
    sdk = mk_sdk()
    ent = ${Name}.${ename}(sdk)
    result = ${Name}.Entity.${EName}.list(ent, S.jm([]))
    assert S.islist(result)
  end
`)
    }

    if (hasLoad) {
      Content(`
  test "should load an existing record" do
    id = first_id()

    if id != nil do
      sdk = mk_sdk()
      ent = ${Name}.${ename}(sdk)
      rec = ${Name}.Entity.${EName}.load(ent, S.jm(["id", id]))
      assert S.ismap(rec)
      assert S.getprop(rec, "id") == id
    end
  end
`)
    }

    if (hasCreate) {
      Content(`
  test "should create then read back" do
    sdk = ${Name}.test(S.jm(["entity", S.jm(["${ename}", S.jm([])])]))
    ent = ${Name}.${ename}(sdk)
    made = ${Name}.Entity.${EName}.create(ent, S.jm(["name", "test-create"]))
    assert S.ismap(made)
    assert S.getprop(made, "id") != nil
  end
`)
    }

    Content(`end
`)
  })
})


export {
  TestEntity
}
