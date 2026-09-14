// A custom edition returns its generated files to docgen for ownership and QA.
export function Main({ model, edition }: any) {
  const targets = Object.values(model.main.kit.target || {})
    .filter((t: any) => t.active !== false).map((t: any) => t.name).sort()
  const path = edition.output.path + '/index.md'
  return { files: { [path]: '# ' + (edition.title || edition.name) +
    '\n\nAPI: ' + model.name + '\n\nTargets: ' + targets.join(', ') + '\n' }, qa: [path] }
}
