
import * as Path from 'node:path'


import {
  Content,
  File,
  Fragment,
  Line,
  cmp,
  each,
} from '@voxgig/sdkgen'


import {
  KIT,
  Model,
  getModelPath,
  nom,
} from '@voxgig/apidef'


import {
  clean,
  formatPhpArray,
} from './utility_php'


const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}
  const authPrefix = getModelPath(model, `main.${KIT}.config.auth.prefix`)
  const baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`)

  File({ name: 'config.' + target.ext }, () => {

    Content(`<?php
declare(strict_types=1);

// ${model.const.Name} SDK configuration

class ${model.const.Name}Config
{
    public static function make_config(): array
    {
        return [
            "main" => [
                "name" => "${model.const.Name}",
            ],
            "feature" => [
`)

    each(feature, (f: any) => {
      const fconfig = f.config || {}
      Content(`                "${f.name}" => ${formatPhpArray(fconfig, 4)},
`)
    })

    Content(`            ],
            "options" => [
                "base" => "${baseUrl}",
                "auth" => [
                    "prefix" => "${authPrefix}",
                ],
                "headers" => ${formatPhpArray(headers, 4)},
                "entity" => [
`)

    each(entity, (entity: any) => {
      Content(`                    "${entity.name}" => [],
`)
    })

    Content(`                ],
            ],
            "entity" => ${formatPhpArray(
      Object.values(entity).reduce((a: any, n: any) => (a[n.name] = clean({
        fields: n.fields,
        name: n.name,
        op: n.op,
        relations: n.relations,
      }), a), {}), 3)},
        ];
    }


    public static function make_feature(string $name)
    {
        require_once __DIR__ . '/features.php';
        return ${model.const.Name}Features::make_feature($name);
    }
}
`)
  })
})


export {
  Config
}
