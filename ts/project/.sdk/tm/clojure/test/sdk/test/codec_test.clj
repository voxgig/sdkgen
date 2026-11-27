;; ProjectName SDK codec suite.
;;
;; Every form, multipart and raw point this SDK has, driven through a real
;; entity operation against a local listener that decodes what arrives. The
;; cases come from the client's own config, so no case names an entity.
(ns sdk.test.codec-test
  (:require [voxgig.struct :as vs]
            [clojure.string :as str]
            [sdk.core :as core]
            [sdk.config :as config]
            [sdk.client :as client]
            [sdk.binary :as binary]
            [sdk.codec.handle :as handle]
            [sdk.testutil :as t])
  (:import [com.sun.net.httpserver HttpServer HttpHandler HttpExchange]
           [java.net InetSocketAddress]))

(def ^:private WRITES #{"create" "update" "patch"})

(defn- latin1 ^String [^bytes bs] (String. bs "ISO-8859-1"))
(defn- bytes-of ^bytes [^String s] (.getBytes s "ISO-8859-1"))
(defn- content [name] (bytes-of (str "file:" name "\u0000ÿ\r\n--")))

(defn- entries [node] (if (vs/ismap node) (sort-by key (into {} node)) []))

;; Each case: {:label :kind :entity :op :point}.
(defn- cases []
  (vec (for [[ename ent] (entries (vs/getprop (config/make-config) "entity"))
             [opname op] (entries (vs/getprop ent "op"))
             point (let [p (vs/getprop op "points")] (if (vs/islist p) (vec p) []))
             [kind side] [[:encoded "body"] [:rawsend "body"] [:rawread "response"]]
             :let [code (vs/getprop (vs/getprop point side) "kind")
                   action (vs/getprop (vs/getprop point "select") "$action")]
             :when (case kind
                     :encoded (and (#{"form" "multipart"} code) (WRITES opname))
                     :rawsend (and (= "raw" code) (WRITES opname))
                     :rawread (and (= "raw" code) (= "load" opname)))]
         {:label (str ename "." opname (when action (str ":" action)) " " (name kind))
          :kind kind :entity ename :op opname :action action :point point})))

(defn- ens [ename sym] (requiring-resolve (symbol (str "sdk.entity." ename) sym)))

(defn- params [point]
  (vec (for [part (let [p (vs/getprop point "parts")] (if (vs/islist p) (vec p) []))
             :let [m (re-matches #"^\{(.+)\}$" (str part))]
             :when m]
         [(second m) "p1"])))

(defn- jmap [pairs] (let [m (vs/jm)] (doseq [[k v] pairs] (.put ^java.util.Map m k v)) m))

(defn- select [action] (if (nil? action) [] [["$action" action]]))

(defn- handle-of [ename ent action]
  (if (nil? action) ((ens ename "binary") ent) ((ens ename "binary") ent action)))

;; The data a form or multipart point is sent, and the parts it must arrive
;; as, every value in latin1.
(defn- plan [body]
  (let [form (= "form" (vs/getprop body "kind"))]
    (reduce
     (fn [[data expect] field]
       (let [n (vs/getprop field "name")]
         (cond
           (true? (vs/getprop field "binary"))
           (let [type (when-not form (or (vs/getprop field "media") "application/octet-stream"))]
             [(conj data [n (binary/bytes (content n) {:name (str "/local/dir/" n ".bin") :type type})])
              (conj expect (if form [n (latin1 (content n))] [n (latin1 (content n)) (str n ".bin") type]))])

           (true? (vs/getprop field "list"))
           [(conj data [n (vs/jt "a" "b c")]) (conj expect [n "a"] [n "b c"])]

           (string? (vs/getprop field "join"))
           [(conj data [n (vs/jt "a" "b")]) (conj expect [n (str "a" (vs/getprop field "join") "b")])]

           :else
           [(conj data [n (str "v\"" n "\r\n")]) (conj expect [n (str "v\"" n "\r\n")])])))
     [[] []]
     (let [f (vs/getprop body "fields")] (if (vs/islist f) (vec f) [])))))

(defn- multipart [arrived]
  (let [type (get-in arrived [:headers "content-type"])
        boundary (second (re-find #"boundary=([^;]+)" (str type)))
        text (latin1 (:body arrived))]
    (t/is-some boundary (str "no boundary in " type))
    (t/is-true (str/ends-with? text (str "--" boundary "--\r\n")) "the body does not close")
    (vec (for [chunk (butlast (rest (str/split text (re-pattern (java.util.regex.Pattern/quote (str "--" boundary))) -1)))]
           (let [at (str/index-of chunk "\r\n\r\n")
                 head (subs chunk 2 at)
                 body (subs chunk (+ at 4) (- (count chunk) 2))
                 [_ n filename] (or (re-find #"(?m)^Content-Disposition: form-data; name=\"([^\"]*)\"(?:; filename=\"([^\"]*)\")?\r?$" head)
                                    (t/fail! (str "a part without a disposition: " (pr-str head))))
                 ctype (second (re-find #"(?m)^Content-Type: ([^\r\n]*)" head))]
             (if (nil? filename) [n body] [n body filename ctype]))))))

(defn- form-pairs [arrived]
  (let [text (latin1 (:body arrived))]
    (vec (for [pair (str/split text #"&") :when (not= "" pair)
               :let [[k v] (str/split pair #"=" 2)]]
           [(java.net.URLDecoder/decode ^String k "ISO-8859-1") (java.net.URLDecoder/decode ^String (or v "") "ISO-8859-1")]))))

(defn- run-case [{:keys [kind entity op action point]} net base]
  (let [sdk (client/make-sdk (vs/jm "base" base))
        ent ((ens entity "make") sdk nil)
        opfn (ens entity op)
        answer (fn [type body] (reset! (:answer net) {:type type :body body}))
        arrived (fn [] (or (last @(:arrivals net)) (t/fail! "nothing arrived")))]
    (case kind
      :encoded
      (let [rb (vs/getprop point "body")
            [data expect] (plan rb)
            names (set (map first expect))]
        (answer "application/json" (bytes-of "{\"id\":\"p1\"}"))
        (opfn ent (jmap (concat (params point) (select action) data)) nil)
        (let [got (if (= "form" (vs/getprop rb "kind"))
                    (do (t/is-eq (get-in (arrived) [:headers "content-type"]) (vs/getprop rb "media") "content type")
                        (form-pairs (arrived)))
                    (multipart (arrived)))]
          (t/is-eq (filterv #(names (first %)) got) expect "the parts that arrived")))

      :rawsend
      (let [rb (vs/getprop point "body")]
        (answer "application/json" (bytes-of "{\"id\":\"p1\"}"))
        ((:data-set ent) (jmap (params point)))
        ((:match-set ent) (jmap (params point)))
        (if (true? (vs/getprop rb "binary"))
          (let [got (handle/put (handle-of entity ent action)
                                (binary/bytes (content op) {:type (vs/getprop rb "media")}))]
            (t/is-true (identical? got ent) "put resolves to the entity")
            (t/is-eq (vec (:body (arrived))) (vec (content op)) "the bytes that arrived"))
          (let [text (str "text \"" op "\"\n")]
            (opfn ent (jmap (concat (select action) [["$body" text]])) nil)
            (t/is-eq (String. ^bytes (:body (arrived)) "UTF-8") text "the text that arrived")))
        (t/is-eq (get-in (arrived) [:headers "content-type"]) (vs/getprop rb "media") "content type"))

      :rawread
      (let [rs (vs/getprop point "response")
            reqmatch (jmap (concat (params point) (select action)))]
        ((:data-set ent) (jmap (params point)))
        ((:match-set ent) (jmap (params point)))
        (if (true? (vs/getprop rs "binary"))
          (do (answer (vs/getprop rs "media") (content op))
              (t/is-eq (vec (handle/bytes (handle-of entity ent action))) (vec (content op)) "the bytes read")
              (t/is-throws #(opfn ent reqmatch nil) "binary_sink_required" "the plain op is refused"))
          (let [text (str "café " op)]
            (answer (vs/getprop rs "media") (.getBytes text "UTF-8"))
            (t/is-true (identical? (opfn ent reqmatch nil) ent) "load resolves to the entity")
            (t/is-eq (vs/getprop ((:data-get ent)) "$body") text "the text read")))))))

(defn- listen [net]
  (let [server (HttpServer/create (InetSocketAddress. "127.0.0.1" 0) 0)]
    (.createContext server "/"
                    (reify HttpHandler
                      (handle [_ ex]
                        (let [^HttpExchange ex ex
                              sent (.readAllBytes (.getRequestBody ex))
                              headers (into {} (for [[k hv] (.getRequestHeaders ex)] [(str/lower-case k) (first hv)]))
                              {:keys [type ^bytes body] :or {type "application/json" body (byte-array 0)}} @(:answer net)]
                          (swap! (:arrivals net) conj {:method (.getRequestMethod ex) :headers headers :body sent})
                          (.add (.getResponseHeaders ex) "Content-Type" type)
                          (.sendResponseHeaders ex 200 (alength body))
                          (with-open [out (.getResponseBody ex)] (.write out body))))))
    (.start server)
    server))

(defn run [rec]
  (let [all (cases)
        net {:answer (atom {}) :arrivals (atom [])}
        server (listen net)
        base (str "http://127.0.0.1:" (.getPort (.getAddress ^HttpServer server)))
        ran (atom 0)
        failed (atom 0)]
    (t/run-check rec "codec: this SDK has a point to drive"
                 #(t/is-true (seq all) "no form, multipart or raw point was found"))
    (try
      (doseq [c all]
        (reset! (:answer net) {})
        (reset! (:arrivals net) [])
        (swap! ran inc)
        (t/run-check (fn [name ok? msg] (when-not ok? (swap! failed inc)) (rec name ok? msg))
                     (str "codec: " (:label c))
                     #(run-case c net base)))
      (finally (.stop ^HttpServer server 0)))
    (println (str "codec: ran " @ran " case(s), " @failed " failed"))))
