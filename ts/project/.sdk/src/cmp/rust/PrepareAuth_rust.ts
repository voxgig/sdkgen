
import {
  Content,
  File,
  Folder,
  cmp,
  isAuthSuppressed,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
  resolveAuthPrefix,
} from '@voxgig/sdkgen'


const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  // The generated source cannot use the `ProjectName` placeholder: that is
  // rewritten by Main's `Copy({from:'tm/rust'})`, and this file never
  // travels through that Copy. The real error type goes in here, spelled
  // the way Main_rust spells it in lib.rs's re-exports.
  const errtype = model.const.Name + 'Error'

  const active = !isAuthSuppressed(model)
  const where = resolveAuthIn(model)
  const name = resolveAuthName(model)
  const prefix = resolveAuthPrefix(model)
  const basic = isHttpBasicAuth(model)

  Folder({ name: 'utility' }, () => {
    File({ name: 'prepare_auth.' + target.ext }, () => {
      Content(render({ errtype, active, where, name, prefix, basic }))
    })
  })
})


type AuthSpec = {
  errtype: string
  active: boolean
  where: string
  name: string
  prefix: string
  basic: boolean
}


function render(spec: AuthSpec): string {

  if (!spec.active) {
    return `// prepare_auth utility.
//
// GENERATED, not templated - see PrepareAuth_rust.
//
// This API declares no authentication, so there is no credential to place.
// The function stays in the pipeline because make_spec calls it
// unconditionally.

use std::cell::RefCell;
use std::rc::Rc;

use crate::core::context::Context;
use crate::core::error::${spec.errtype};
use crate::core::spec::Spec;

pub fn prepare_auth_util(ctx: &Rc<Context>) -> Result<Rc<RefCell<Spec>>, ${spec.errtype}> {
    let spec = ctx.spec.borrow().clone().ok_or_else(|| {
        ctx.make_error("auth_no_spec", "Expected context spec property to be defined.")
    })?;

    Ok(spec)
}
`
  }

  // HTTP Basic is header-only by definition: the scheme is
  // `Authorization: Basic base64(user:pass)`. It cannot be expressed as a
  // query parameter or a cookie, so the branch is emitted only where it can
  // mean something. The encoder is the clean utility's, which needs it for
  // the base64 form of every registered value.
  const withBasic = spec.basic && 'header' === spec.where

  const withGetpath = 'header' === spec.where

  const bag = bagName(spec.where)

  const head = `// prepare_auth utility.
//
// GENERATED, not templated: where the credential goes - header, query or
// cookie, and under what name - is a fact about THIS API, and tm/ can only
// hold one answer. See PrepareAuth_rust.

use std::cell::RefCell;
use std::rc::Rc;

use crate::core::context::Context;
use crate::core::error::${spec.errtype};
use crate::core::helpers::{getp, ${withGetpath ? 'getpath, ' : ''}setp};
use crate::core::spec::Spec;
${withBasic ? `use crate::utility::clean::{base64_encode, clean_add};
` : ''}use crate::utility::voxgigstruct as vs;
use crate::utility::voxgigstruct::Value;

${credComment(spec.where)}
const CRED_NAME: &str = "${ruststr(credLiteral(spec.where, spec.name))}";
${'cookie' === spec.where ? `const COOKIE_HEADER: &str = "cookie";
` : ''}const OPTION_APIKEY: &str = "apikey";
${withBasic ? `const OPTION_SECRET: &str = "secret";
` : ''}const NOT_FOUND: &str = "__NOTFOUND__";

pub fn prepare_auth_util(ctx: &Rc<Context>) -> Result<Rc<RefCell<Spec>>, ${spec.errtype}> {
    let spec = ctx.spec.borrow().clone().ok_or_else(|| {
        ctx.make_error("auth_no_spec", "Expected context spec property to be defined.")
    })?;

    let ${bag} = spec.borrow().${bag}.clone();
    let options = match ctx.client.borrow().clone() {
        Some(client) => client.options_map(),
        None => ctx.options.borrow().clone(),
    };

    // Public APIs that need no auth omit the options.auth block entirely.
    let auth = getp(&options, "auth");
    if auth.is_noval() || auth.is_null() {
        ${clear(spec.where)};
        return Ok(spec);
    }

    let apikey = vs::get_prop(&options, &Value::str(OPTION_APIKEY), Value::str(NOT_FOUND));

    let skip = match &apikey {
        Value::Noval | Value::Null => true,
        Value::Str(s) => s == NOT_FOUND || s.is_empty(),
        _ => false,
    };
`

  const basicBlock = !withBasic ? '' : `
    // True HTTP Basic Auth joins the two credentials, base64-encoded - a single
    // token in the header (the branch below) can never authenticate against
    // an API that actually checks \`Authorization: Basic base64(user:pass)\`.
    // The password may be empty (RFC 7617): Lob, for one, documents the key as
    // the user with a blank password (\`curl -u key:\`).
    if let Value::Bool(true) = getpath(&["auth", "basic"], &options) {
        let secret = vs::get_prop(&options, &Value::str(OPTION_SECRET), Value::str(NOT_FOUND));

        let no_secret = match &secret {
            Value::Noval | Value::Null => true,
            Value::Str(s) => s == NOT_FOUND || s.is_empty(),
            _ => false,
        };

        if skip {
            vs::del_prop(headers, &Value::str(CRED_NAME));
        } else {
            let apikey_val = match &apikey {
                Value::Str(s) => s.clone(),
                _ => String::new(),
            };
            let secret_val = match &secret {
                Value::Str(s) if !no_secret => s.clone(),
                _ => String::new(),
            };
            let b64 = base64_encode(format!("{}:{}", apikey_val, secret_val).as_bytes());
            // The joined, encoded pair is a wire form neither credential's own
            // registration covers.
            clean_add(ctx, &b64);

            let auth_prefix = match getpath(&["auth", "prefix"], &options) {
                Value::Str(s) => s,
                _ => String::new(),
            };
            // Empty prefix (raw apiKey credential) must not add a leading space.
            if auth_prefix.is_empty() {
                setp(&headers, CRED_NAME, Value::str(b64));
            } else {
                setp(
                    &headers,
                    CRED_NAME,
                    Value::str(format!("{} {}", auth_prefix, b64)),
                );
            }
        }

        return Ok(spec);
    }
`

  const tail = `
    if skip {
        ${clear(spec.where)};
    } else {
${place(spec.where)}
    }

    Ok(spec)
}
`

  return head + basicBlock + tail
}


function credLiteral(where: string, name: string): string {
  return 'header' === where ? String(name).toLowerCase() : String(name)
}


function credComment(where: string): string {
  if ('query' === where) {
    return '/// The query parameter this API reads the credential from.'
  }
  if ('cookie' === where) {
    return '/// The cookie name this API reads the credential from.'
  }
  return '/// The header this API reads the credential from.'
}


function bagName(where: string): string {
  return 'query' === where ? 'query' : 'headers'
}


function clear(where: string): string {
  return `vs::del_prop(${bagName(where)}, &Value::str(CRED_NAME))`
}


function place(where: string): string {
  if ('query' === where) {
    return `        let apikey_val = match &apikey {
            Value::Str(s) => s.clone(),
            _ => String::new(),
        };
        // No prefix: a query parameter carries the raw credential.
        setp(&query, CRED_NAME, Value::str(apikey_val));`
  }

  if ('cookie' === where) {
    return `        let apikey_val = match &apikey {
            Value::Str(s) => s.clone(),
            _ => String::new(),
        };
        let pair = format!("{}={}", CRED_NAME, apikey_val);
        // APPEND: the cookie header may already carry pairs this SDK did not
        // set, and replacing it outright would drop them.
        let existing = match getp(&headers, COOKIE_HEADER) {
            Value::Str(s) => s,
            _ => String::new(),
        };
        if existing.is_empty() {
            setp(&headers, COOKIE_HEADER, Value::str(pair));
        } else {
            setp(
                &headers,
                COOKIE_HEADER,
                Value::str(format!("{}; {}", existing, pair)),
            );
        }`
  }

  return `        let auth_prefix = match getpath(&["auth", "prefix"], &options) {
            Value::Str(s) => s,
            _ => String::new(),
        };
        let apikey_val = match &apikey {
            Value::Str(s) => s.clone(),
            _ => String::new(),
        };
        // Empty prefix (raw apiKey credential) must not add a leading space.
        if auth_prefix.is_empty() {
            setp(&headers, CRED_NAME, Value::str(apikey_val));
        } else {
            setp(
                &headers,
                CRED_NAME,
                Value::str(format!("{} {}", auth_prefix, apikey_val)),
            );
        }`
}


function ruststr(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}


export {
  PrepareAuth
}
