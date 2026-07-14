
import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import type {
  ModelEntity
} from '@voxgig/apidef'

import { cmp, each, File, Content, Folder } from '@voxgig/sdkgen'


// Generates sdk/gentest.clj (ns sdk.gentest): the API-specific tests, driven by
// the model. Exposes (run rec) which the template test-runner invokes. Covers
// entity accessor existence plus a create+list smoke run through the in-memory
// test-mode mock transport (exercising the full operation pipeline, hooks and
// run-op for the actual API entities). API-agnostic behaviour (pipeline error
// branches, all features, netsim, primary utility, struct corpus) lives in the
// static template test namespaces.
const Test = cmp(function Test(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const entity: ModelEntity = getModelPath(model, `main.${KIT}.entity`)
  const entities = Object.values(entity) as any[]

  Folder({ name: 'test' }, () => {
    Folder({ name: 'sdk' }, () => {
      File({ name: 'gentest.' + target.ext }, () => {

        let requires = ''
        each(entity, (e: any) => {
          requires += `\n            [sdk.entity.${e.name} :as e-${e.name}]`
        })

        Content(`;; ${model.const.Name} SDK generated API tests.
(ns sdk.gentest
  (:require [sdk.api :as api]
            [sdk.config :as config]
            [sdk.testutil :as t]
            [voxgig.struct :as vs]${requires}))

(defn run [rec]
`)

        each(entity, (e: any) => {
          Content(`  (t/run-check rec "gen-exists-${e.name}"
    (fn [] (let [sdk (api/test-sdk nil nil)]
             (t/is-true (some? (api/${e.name} sdk nil)) "${e.name} accessor present"))))
`)
        })

        for (const e of entities) {
          const ops = Object.keys(e.op || {})
          const hasCreate = ops.includes('create')
          const hasList = ops.includes('list')
          if (!hasCreate && !hasList) {
            continue
          }
          Content(`  (t/run-check rec "gen-smoke-${e.name}"
    (fn [] (let [sdk (api/test-sdk nil nil)
                 ent (api/${e.name} sdk nil)]
`)
          if (hasCreate) {
            Content(`             (let [res (e-${e.name}/create ent (vs/jm "name" "smoke") nil)]
               (t/is-true (vs/ismap res) "create returns a record map")
               (t/is-true (some? (vs/getprop res "id")) "created record has an id"))
`)
          }
          if (hasList) {
            Content(`             (let [items (e-${e.name}/list ent (vs/jm) nil)]
               (t/is-true (sequential? items) "list returns a sequential collection"))
`)
          }
          Content(`             )))
`)

          // PR review #4: entity stream(action, args, callopts). Runs the op
          // through the full pipeline and returns a lazy seq of items. Seeds
          // three records via the test mock (SDK.test entity seed) and streams
          // them; needs only a list op.
          if (hasList) {
            Content(`  (t/run-check rec "gen-stream-${e.name}"
    (fn [] (let [seed (vs/jm "${e.name}" (vs/jm "S1" (vs/jm "id" "S1" "name" "a")
                                                "S2" (vs/jm "id" "S2" "name" "b")
                                                "S3" (vs/jm "id" "S3" "name" "c")))]
             ;; Fallback (no streaming feature): materialised items.
             (let [sdk (api/test-sdk (vs/jm "entity" seed) nil)
                   items (vec (e-${e.name}/stream (api/${e.name} sdk nil) "list" (vs/jm) nil))]
               (t/is-eq (count items) 3 "stream fallback yields materialised items")
               (t/is-true (vs/ismap (first items)) "stream yields bare record maps"))
             ;; signal cancels iteration between yields.
             (let [sdk (api/test-sdk (vs/jm "entity" seed) nil)
                   n (atom 0) sig (fn [] (>= (swap! n inc) 2))
                   items (vec (e-${e.name}/stream (api/${e.name} sdk nil) "list" (vs/jm) (vs/jm "signal" sig)))]
               (t/is-eq (count items) 1 "stream signal stops after first yield"))
             ;; Streaming feature active: yields from the streaming iterator.
             (when (vs/getpath (config/make-config) "feature.streaming")
               (let [ssdk (api/test-sdk (vs/jm "entity" seed) (vs/jm "feature" (vs/jm "streaming" (vs/jm "active" true))))]
                 (t/is-eq (count (vec (e-${e.name}/stream (api/${e.name} ssdk nil) "list" (vs/jm) nil))) 3
                          "stream (streaming active) yields all items"))
               (let [csdk (api/test-sdk (vs/jm "entity" seed) (vs/jm "feature" (vs/jm "streaming" (vs/jm "active" true "chunkSize" 2))))
                     batches (vec (e-${e.name}/stream (api/${e.name} csdk nil) "list" (vs/jm) nil))]
                 (t/is-eq (count batches) 2 "stream chunkSize groups items into 2 batches"))))))
`)
          }
        }

        Content(`  nil)
`)
      })
    })
  })
})


export {
  Test
}
