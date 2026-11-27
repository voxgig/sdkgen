;; ProjectName SDK multipart codec: multipart/form-data.
(ns sdk.codec.multipart
  (:require [voxgig.struct :as vs]
            [clojure.string :as str]
            [sdk.core :as core]
            [sdk.binary :as binary]))

(def ^:private MULTIPART-MEDIA "multipart/form-data")
(def ^:private OCTET-MEDIA "application/octet-stream")
(def ^:private CRLF "\r\n")

(defn boundary [_ctx]
  (let [bs (byte-array 16)]
    (.nextBytes (java.security.SecureRandom.) bs)
    (apply str (map #(format "%02x" (bit-and (int %) 0xff)) bs))))

;; Inside a quoted header parameter nothing may end the quote or the line.
(defn quoted [^String text]
  (-> text (str/replace "\\" "%5C") (str/replace "\"" "%22") (str/replace "\r" "%0D") (str/replace "\n" "%0A")))

;; A local path never leaves: only its last segment, and nothing for an
;; empty one.
(defn base-name [name]
  (when (string? name)
    (let [base (last (str/split name #"[\\/]" -1))]
      (when-not (or (nil? base) (= "" base)) base))))

(defn- file-part [ctx name field value]
  (let [src? (binary/source? value)
        ^sdk.binary.BinarySource s (when src? value)
        content (if src? (.-data s) value)]
    (if (binary/stream? content)
      (core/ctx-error ctx "binary_feature_inactive"
                      (str "The multipart field \"" name
                           "\" holds a stream, which needs the binary feature: pass bytes, a Blob or a source."))
      {:name name
       :filename (when src? (base-name (.-name s)))
       :type (or (when src? (.-type s)) (vs/getprop field "media") OCTET-MEDIA)
       :content (binary/to-bytes content)})))

(defn- text-part [name field value]
  {:name name :type (vs/getprop field "media") :content (binary/to-bytes value)})

;; {"type" "body"}, or the error. The body is the bytes of every part.
(defn encode [ctx data lifted]
  (let [body (vs/getprop (core/oget ctx :point) "body")
        b ((core/uget ctx :multipart-boundary) ctx)
        out (java.io.ByteArrayOutputStream.)
        put (fn [^bytes bs] (.write out bs 0 (alength bs)))
        text (fn [^String s] (put (.getBytes s "UTF-8")))]
    (or
     (some (fn [{:keys [name field value] :as item}]
             (let [part (if (:binary item) (file-part ctx name field value) (text-part name field value))
                   type (:type part)]
               (cond
                 (core/sdk-error? part) part
                 (and (string? type) (or (str/includes? type "\r") (str/includes? type "\n")))
                 (core/ctx-error ctx "binary_source_refused"
                                 (str "The media type of the multipart field \"" name "\" contains a line break."))
                 :else
                 (do (text (str "--" b CRLF "Content-Disposition: form-data; name=\"" (quoted (:name part)) "\""
                                (if (nil? (:filename part)) "" (str "; filename=\"" (quoted (:filename part)) "\""))
                                CRLF (if (nil? type) "" (str "Content-Type: " type CRLF)) CRLF))
                     (put (:content part))
                     (text CRLF)
                     nil))))
           (binary/body-items body data lifted))
     (let [media (vs/getprop body "media")
           declared (if (string? media) (str/trim (first (str/split media #";" 2))) "")]
       (text (str "--" b "--" CRLF))
       {"type" (str (if (= "" declared) MULTIPART-MEDIA declared) "; boundary=" b)
        "body" (.toByteArray out)}))))
