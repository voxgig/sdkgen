
import {
  Content,
  File,
  cmp,
  each,
  isAuthActive,
  resolveAuthPrefix,
} from '@voxgig/sdkgen'


import {
  KIT,
  Model,
  getModelPath,
} from '@voxgig/apidef'


import {
  clean,
} from './utility_perl'


// The config is emitted as a JSON heredoc parsed at load time by the
// vendored struct utility (Voxgig::Struct::parse_json). This keeps
// booleans/nulls faithful (Perl has no native boolean scalar) and yields
// insertion-ordered maps - and stays N-feature-safe: any number of
// features simply serialize into the "feature" block.
const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  // config.auth.prefix override -> spec-derived info.security.prefix -> 'Bearer'
  const authPrefix = resolveAuthPrefix(model)

  let baseUrl = ''
  try { baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`) } catch (_e) { }

  // Build the config structure with deterministic (sorted) key order for
  // the model-derived collections (each() iterates sorted).
  const featureBlock: any = {}
  each(feature, (f: any) => {
    featureBlock[f.name] = clean(f.config || {})
  })

  const entityOptions: any = {}
  each(entity, (ent: any) => {
    entityOptions[ent.name] = {}
  })

  const entityBlock: any = {}
  each(entity, (ent: any) => {
    entityBlock[ent.name] = clean({
      fields: ent.fields,
      name: ent.name,
      op: ent.op,
      relations: ent.relations,
    })
  })

  const options: any = {
    base: baseUrl,
  }
  if (authActive) {
    options.auth = { prefix: authPrefix }
  }
  options.headers = headers
  options.entity = entityOptions

  const config = {
    main: { name: model.const.Name },
    feature: featureBlock,
    options,
    entity: entityBlock,
  }

  const configJson = JSON.stringify(config, null, 2)

  File({ name: 'config.pm' }, () => {

    Content(`# ${model.const.Name} SDK configuration

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/lib/Voxgig/Struct.pm"));

package ${model.const.Name}Config;

# GENERATED from the API model - do not edit by hand. Parsed fresh on
# each call so callers can safely mutate their copy.
my $CONFIG_JSON = <<'END_CONFIG_JSON';
${configJson}
END_CONFIG_JSON

sub make_config {
  return Voxgig::Struct::parse_json($CONFIG_JSON);
}

sub make_feature {
  my ($name) = @_;
  require(Cwd::abs_path("$__dir/features.pm"));
  return ${model.const.Name}Features::make_feature($name);
}

1;
`)
  })
})


export {
  Config
}
