
import { cmp, Content, directRoute } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { target } = props
  const dx = directRoute(props.ctx$.model)

  Content(`**Clojure:**
\`\`\`clojure
(def result
  (api/direct client
    (vs/jm "path" "${dx.path}"
           "method" "${dx.method}"
           "params" (vs/jm "${dx.param}" "example"))))
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
