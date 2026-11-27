;; ProjectName SDK form codec: application/x-www-form-urlencoded.
(ns sdk.codec.form
  (:require [voxgig.struct :as vs]
            [sdk.core :as core]
            [sdk.binary :as binary]))

(def ^:private FORM-MEDIA "application/x-www-form-urlencoded")

(def ^:private HEX "0123456789ABCDEF")

;; Alphanumerics and `*-._` as they are, a space as `+`, every other byte as
;; %HH.
(defn escape [^bytes bs]
  (let [sb (StringBuilder.)]
    (doseq [b bs]
      (let [c (bit-and (int b) 0xff)]
        (cond
          (or (<= 0x30 c 0x39) (<= 0x41 c 0x5a) (<= 0x61 c 0x7a) (#{0x2a 0x2d 0x2e 0x5f} c))
          (.append sb (char c))
          (= 0x20 c) (.append sb "+")
          :else (.append sb (str "%" (.charAt ^String HEX (bit-shift-right c 4)) (.charAt ^String HEX (bit-and c 15)))))))
    (str sb)))

;; {"type" "body"}, or the error.
(defn encode [ctx data lifted]
  (let [body (vs/getprop (core/oget ctx :point) "body")
        media (vs/getprop body "media")]
    (loop [items (binary/body-items body data lifted) pairs []]
      (if (empty? items)
        {"type" (if (and (string? media) (not= "" media)) media FORM-MEDIA)
         "body" (clojure.string/join "&" pairs)}
        (let [{:keys [name value]} (first items)
              content (if (binary/source? value) (.-data ^sdk.binary.BinarySource value) value)]
          (if (binary/stream? content)
            (core/ctx-error ctx "binary_source_refused"
                            (str "The form field \"" name
                                 "\" holds a Blob or a stream, which a form body cannot carry: pass its bytes."))
            (recur (rest items)
                   (conj pairs (str (escape (binary/to-bytes name)) "=" (escape (binary/to-bytes content)))))))))))
