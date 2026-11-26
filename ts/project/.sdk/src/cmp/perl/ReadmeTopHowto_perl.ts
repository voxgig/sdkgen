
import { cmp, Content, directRoute } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { target } = props
  const dx = directRoute(props.ctx$.model)

  Content(`**Perl:**
\`\`\`perl
my $result = $client->direct({
    'path' => '${dx.path}',
    'method' => '${dx.method}',
    'params' => { '${dx.param}' => 'example' },
});
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
