
import { cmp, Content, fact } from '@voxgig/sdkgen'


const ReadmeExamplesTest = cmp(function ReadmeExamplesTest(props: any) {
  const { target } = props
  // The root README where the run writes one beside this target, and the
  // target's own documents where it writes them.
  const link = fact(target, 'link').readme
  const own = fact(target, 'phase').readme
  if ('' === link && !own) {
    return
  }

  Content(`  (letfn [(fence-pat [] (re-pattern (apply str (repeat 3 (char 96)))))
          (fence-count [text] (count (re-seq (fence-pat) text)))
          (clj-blocks [text]
            (let [parts (clojure.string/split text (fence-pat))]
              (->> parts
                   (map-indexed vector)
                   (filter (fn [[i _]] (odd? i)))
                   (map (fn [[_ seg]] seg))
                   (filter (fn [seg]
                             (= "clojure"
                                (clojure.string/trim (first (clojure.string/split-lines seg))))))
                   (map (fn [seg]
                          (clojure.string/join "\\n"
                            (rest (clojure.string/split-lines seg))))))))]
    (doseq [[label path] [${[...('' === link ? [] : [`["root-README" "${link}"]`]),
      ...(own ? ['["README" "README.md"]', '["REFERENCE" "REFERENCE.md"]'] : [])]
      .join('\n                          ')}]]
      (t/run-check rec (str "gen-readme-examples-" label)
        (fn []
          (if-not (.exists (java.io.File. ^String path))
            (t/is-true true (str label " absent (skipped)"))
            (let [text (slurp path)]
              ;; A code fence opened but never closed leaves an ODD number of
              ;; fence markers; the split-on-fence then captures the trailing
              ;; prose (everything after the last opener) as if it were a
              ;; clojure block, which can parse cleanly and pass silently. Fail
              ;; on the malformed doc instead. (Count markers directly rather
              ;; than split parts: split drops trailing empty segments, so a
              ;; closing fence at EOF would be miscounted.)
              (t/is-true (even? (fence-count text))
                         (str label " code fences balanced (no unclosed fence)"))
              (let [blocks (clj-blocks text)]
                (doseq [b blocks]
                  (binding [*read-eval* false]
                    (read-string (str "[\\n" b "\\n]"))))
                (t/is-true true (str label " clojure blocks parse cleanly")))))))))
`)
})


export {
  ReadmeExamplesTest
}
