;; ProjectName SDK binary handle: an entity's named bytes.
;;
;; Each call is one run of the entity's own operation on the slot's point; in
;; core only whole, in-memory bodies move. A slot is the action whose points
;; move its bytes ("" for the entity's own) and the operations that read and
;; write them: {"action" "read" "write"}. `ops` maps an operation name to the
;; entity namespace's function.
(ns sdk.codec.handle
  (:refer-clojure :exclude [bytes])
  (:require [voxgig.struct :as vs]
            [sdk.core :as core]))

(defn handle
  ([entity slots ops] (handle entity slots ops nil))
  ([entity slots ops slot]
   (let [slot (if (nil? slot) "" (str slot))]
     {:entity entity :slot slot :def (get slots slot) :ops ops})))

(defn- entname [h] ((:get-name (:entity h))))

(defn- error [h code msg]
  (core/sdk-throw (core/ctx-error (:_entctx (:entity h)) code msg)))

(defn- inactive [h what]
  (error h "binary_feature_inactive"
         (str "The binary slot \"" (:slot h) "\" of entity \"" (entname h) "\" cannot " what
              " without the binary feature; in core it answers bytes() and put().")))

(defn- direction [h way]
  (let [d (:def h)]
    (cond
      (nil? d) (error h "binary_slot_unknown" (str "Entity \"" (entname h) "\" has no binary slot \"" (:slot h) "\"."))
      (nil? (get d way)) (error h "binary_slot_direction"
                                (str "The binary slot \"" (:slot h) "\" of entity \"" (entname h) "\" cannot be "
                                     (if (= "read" way) "read" "written") "."))
      :else d)))

(defn- select [d] (if (= "" (get d "action")) (vs/jm) (vs/jm "$action" (get d "action"))))

;; The caller's control, with the transfer beside its own keys.
(defn- call [h opname arg ctrl transfer]
  (let [out (vs/jm)]
    (when (instance? java.util.Map ctrl)
      (doseq [^java.util.Map$Entry e (.entrySet ^java.util.Map ctrl)]
        (.put ^java.util.Map out (let [k (.getKey e)] (if (keyword? k) (name k) k)) (.getValue e))))
    (.put ^java.util.Map out "transfer" transfer)
    ((get (:ops h) opname) (:entity h) arg out)))

(defn- range-of [opts]
  (when (instance? java.util.Map opts)
    (or (.get ^java.util.Map opts :range) (.get ^java.util.Map opts "range"))))

;; The whole body, within maxBuffer.
(defn bytes
  ([h] (bytes h nil nil))
  ([h opts] (bytes h opts nil))
  ([h opts ctrl]
   (when (some? (range-of opts)) (inactive h "read a range"))
   (let [d (direction h "read")
         transfer (vs/jm "slot" (:slot h) "direction" "read")]
     (call h (get d "read") (select d) ctrl transfer)
     (or (vs/getprop transfer "bytes") (byte-array 0)))))

;; Sends in-memory content as the slot's body; resolves to the entity.
(defn put
  ([h source] (put h source nil))
  ([h source ctrl]
   (let [d (direction h "write")
         arg (select d)]
     (.put ^java.util.Map arg "$body" source)
     (call h (get d "write") arg ctrl (vs/jm "slot" (:slot h) "direction" "write"))
     (:entity h))))

(defn save [h & _] (inactive h "save"))
(defn stream [h & _] (inactive h "stream"))
(defn open [h & _] (inactive h "open"))
