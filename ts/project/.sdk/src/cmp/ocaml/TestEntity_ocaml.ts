
import {
  Content,
  File,
  cmp,
} from '@voxgig/sdkgen'

import { ocamlString, ocamlVarName } from './utility_ocaml'


// Generated per-entity test: the accessor yields an entity with the right
// name, and (test mode) the present read ops round-trip through the full
// pipeline against seeded mock data (list returns the seeded record; load by
// id returns it). Mirrors the intent of the rust/go TestEntity flow, but
// self-contained (inline seed, no external fixture).
const TestEntity = cmp(function TestEntity(props: any) {
  const { target, entity } = props

  const fn = ocamlVarName(entity.name)
  const opnames = Object.keys(entity.op || {})
  const hasList = opnames.includes('list')
  const hasLoad = opnames.includes('load')
  const hasId = null != entity.id
  const id = entity.name + '01'

  File({ name: entity.name + '_entity_test.' + target.ext }, () => {

    Content(`(* Generated ${entity.name} entity test. *)

open Voxgig_struct
open Sdk_types
open Sdk_helpers
open Testutil

let () =
  test "${ocamlString(entity.name)}.entity_instance" (fun () ->
      let client = Sdk_client.test () in
      let ent = Sdk_client.${fn} client Noval in
      check_str "name" ent.e_name "${ocamlString(entity.name)}")
`)

    // Seeded test-mode round-trip: the test feature builds an in-memory mock
    // from options.entity, so a seeded record is loadable/listable.
    if (hasList || hasLoad) {
      Content(`
let () =
  test "${ocamlString(entity.name)}.seeded_ops" (fun () ->
      let record = jo [("id", Str "${ocamlString(id)}")] in
      let seed = jo [("${ocamlString(entity.name)}",
                      jo [("${ocamlString(id)}", record)])] in
      let client = Sdk_client.test_with (jo [("entity", seed)]) Noval in
      let ent = Sdk_client.${fn} client Noval in
      ignore ent;
`)
      if (hasList) {
        Content(`      let listed = ent.e_list (empty_map ()) Noval in
      check "list is a list" (islist listed);
      check_int "list size" (size listed) 1;
`)
      }
      if (hasLoad) {
        Content(`      let loaded = ent.e_load (jo [("id", Str "${ocamlString(id)}")]) Noval in
      check "load is a map" (ismap loaded);
`)
        if (hasId) {
          Content(`      check_vstr "load id" (getp loaded "id") "${ocamlString(id)}";
`)
        }
      }
      Content(`      ())
`)
    }
  })
})


export {
  TestEntity
}
