;; ProjectName SDK concurrency tests - requests in flight at once on one
;; client. Each resolves its operation through the cache the client's root
;; context shares with every request, and registers and cleans secrets
;; through the one registry the client holds.
(ns sdk.test.concurrency
  (:require [sdk.core :as core]
            [sdk.client :as client]
            [sdk.testutil :as t]
            [voxgig.struct :as vs])
  (:import [java.util.concurrent ConcurrentLinkedQueue CountDownLatch CyclicBarrier]))

(def ^:private rounds 200)
(def ^:private width 8)
(def ^:private ops 32)
(def ^:private masked "a [redacted] b [redacted] c")

;; Runs body on width threads released together, and returns what they threw.
(defn- at-once [body]
  (let [start (CyclicBarrier. width)
        thrown (ConcurrentLinkedQueue.)
        threads (mapv (fn [n]
                        (doto (Thread. ^Runnable (fn []
                                                   (try
                                                     (.await start)
                                                     (body n)
                                                     (catch Throwable e (.add thrown e)))))
                          (.start)))
                      (range width))]
    (doseq [^Thread thread threads] (.join thread))
    (vec thrown)))

(defn- resolve-op [root k]
  (core/oget (core/make-context (vs/jm "opname" (str "op" k)) root) :op))

(defn- resolutions-share-one-cached-operation []
  (dotimes [round rounds]
    (let [sdk (client/test-sdk nil nil)
          root @(:root-ctx sdk)
          got (vec (repeatedly width #(object-array ops)))
          thrown (at-once (fn [n] (dotimes [k ops] (aset ^objects (got n) k (resolve-op root k)))))]
      (t/is-true (empty? thrown) (str "round " round " threw: " (pr-str thrown)))
      (dotimes [k ops]
        (let [cached (resolve-op root k)]
          (dotimes [n width]
            (t/is-true (identical? cached (aget ^objects (got n) k))
                       (str "round " round ": op" k " resolved to more than one Operation"))))))))

;; Secrets registered on some threads while others clean: every clean masks
;; what was registered before it, the longer secret whole, and no
;; registration is lost.
(defn- registration-keeps-every-secret-masked []
  (dotimes [round (quot rounds 4)]
    (let [sdk (client/test-sdk nil nil)
          root @(:root-ctx sdk)
          clean (fn [v] ((core/uget root :clean) root v))
          clean-add (fn [v] ((core/uget root :clean-add) root v))
          inner (str "INNER-SECRET-" round)
          text (str "a " inner " b OUTER-" inner "-TAIL c")
          _ (clean-add inner)
          _ (clean-add (str "OUTER-" inner "-TAIL"))
          _ (t/is-eq (clean text) masked (str "round " round))
          registering (CountDownLatch. (quot width 2))
          wrong (ConcurrentLinkedQueue.)
          thrown (at-once
                  (fn [n]
                    (if (< n (quot width 2))
                      (try
                        (dotimes [k ops] (clean-add (str "ADDED-SECRET-" round "-" n "-" k)))
                        (finally (.countDown registering)))
                      (loop []
                        (when (pos? (.getCount registering))
                          (let [got (clean text)]
                            (if (= masked got) (recur) (.add wrong got))))))))]
      (t/is-true (empty? thrown) (str "round " round " threw: " (pr-str thrown)))
      (t/is-true (.isEmpty wrong) (str "round " round " cleaned to: " (pr-str (vec wrong))))
      (dotimes [n (quot width 2)]
        (dotimes [k ops]
          (let [added (str "ADDED-SECRET-" round "-" n "-" k)]
            (t/is-eq (clean added) "[redacted]"
                     (str "round " round ": " added " was registered but not masked"))))))))

(defn run [rec]
  (let [ran (atom 0)
        failed (atom 0)
        counting (fn [name ok? msg]
                   (swap! ran inc)
                   (when-not ok? (swap! failed inc))
                   (rec name ok? msg))]
    (t/run-check counting "concurrency-resolutions-share-one-cached-operation"
                 resolutions-share-one-cached-operation)
    (t/run-check counting "concurrency-registration-keeps-every-secret-masked"
                 registration-keeps-every-secret-masked)
    (println (str "concurrency: " @ran " check(s), " @failed " failed"))))
