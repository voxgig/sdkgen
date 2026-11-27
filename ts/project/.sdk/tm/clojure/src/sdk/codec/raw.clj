;; ProjectName SDK raw codec: a success body read whole, to the maxBuffer bound.
(ns sdk.codec.raw
  (:refer-clojure :exclude [read])
  (:require [voxgig.struct :as vs]
            [clojure.string :as str]
            [sdk.core :as core]))

(def ^:private DEFAULT-MAX 16777216)

(defn max-buffer [ctx]
  (long (or (some #(when (and (number? %) (<= 0 %)) %)
                  [(vs/getprop (core/oget ctx :options) "maxBuffer") (vs/getprop (core/optspec) "maxBuffer")])
            DEFAULT-MAX)))

(defn- too-large [ctx code max declared]
  (core/ctx-error ctx code (str "response: body " (if (nil? declared) "is longer than"
                                                       (str "of " declared " bytes exceeds"))
                                " maxBuffer (" max " bytes)")))

(defn- declared-length [headers]
  (let [v (some (fn [item] (when (= "content-length" (str/lower-case (str (vs/getprop item 0))))
                             (str/trim (str (vs/getprop item 1)))))
                (or (when (vs/ismap headers) (vs/items headers)) []))]
    (when (and v (re-matches #"\d+" v)) (Long/parseLong v))))

;; The transport's bytes where it kept them beside the text it decoded; a
;; body that arrives in chunks is a stream or a sequence of chunks.
(defn- chunks [response]
  (let [read (core/oget response :bytes)
        body (if (fn? read) (read) (core/oget response :body))]
    (cond
      (nil? body) []
      (bytes? body) [body]
      (string? body) [(.getBytes ^String body "UTF-8")]
      (instance? java.io.InputStream body)
      (let [^java.io.InputStream in body
            step (fn step [] (lazy-seq (let [buf (byte-array 8192) n (.read in buf)]
                                         (when (pos? n) (cons (java.util.Arrays/copyOf buf n) (step))))))]
        (step))
      ;; One chunk at a time: a chunked seq would pull past the bound.
      :else ((fn step [cs] (lazy-seq (when-let [cs (seq cs)]
                                       (let [c (first cs)]
                                         (cons (if (bytes? c) c (.getBytes (str c) "UTF-8")) (step (rest cs)))))))
             body))))

;; [bytes nil] or [nil err]: refused by the declared length before a byte is
;; pulled, else by the count as it arrives.
(defn read-bounded [ctx response max code]
  (let [declared (declared-length (core/oget response :headers))]
    (if (and declared (< max declared))
      [nil (too-large ctx code max declared)]
      (let [out (java.io.ByteArrayOutputStream.)]
        (loop [cs (chunks response) n 0]
          (if-let [^bytes c (first cs)]
            (let [n (+ n (alength c))]
              (if (< max n)
                [nil (too-large ctx code max nil)]
                (do (.write out c 0 (alength c)) (recur (rest cs) n))))
            [(.toByteArray out) nil]))))))

;; Text into the record under `$body`; bytes only into a binary handle's
;; read, never into the record.
(defn read [ctx]
  (let [response (core/oget ctx :response)
        result (core/oget ctx :result)
        transfer (core/oget (core/oget ctx :ctrl) :transfer)
        max (max-buffer ctx)]
    (if (true? (vs/getprop (vs/getprop (core/oget ctx :point) "response") "binary"))
      (do (core/oset! result :body nil)
          (when (and (vs/ismap transfer) (= "read" (vs/getprop transfer "direction")))
            (let [[bs err] (read-bounded ctx response max "binary_too_large")]
              (if err (core/oset! result :err err) (.put ^java.util.Map transfer "bytes" bs)))))
      (let [[bs err] (read-bounded ctx response max "response_too_large")]
        (if err
          (core/oset! result :err err)
          (core/oset! result :body (vs/jm "$body" (String. ^bytes bs "UTF-8"))))))
    result))
