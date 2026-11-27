use std::collections::HashMap;
use std::rc::Rc;
use std::sync::{Mutex, OnceLock};

use crate::core::context::Context;
use crate::core::error::ProjectNameError;
use crate::core::helpers::{call_vfn, get_str, getp, getpath, ja, jo, json_thunk, setp};
use crate::utility::voxgigstruct::Value;

// One agent per `proxy` annotation (set by the proxy feature): ureq pools
// keep-alive connections per agent, and cloning shares the pool. None
// follows a redirect: ureq offers no hook on a hop, so the hops are made in
// default_http_fetch.
fn agent_for(fetchdef: &Value) -> ureq::Agent {
    let proxy = get_str(fetchdef, "proxy").filter(|p| !p.is_empty());

    static AGENTS: OnceLock<Mutex<HashMap<Option<String>, ureq::Agent>>> = OnceLock::new();
    let mut agents = AGENTS
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    agents
        .entry(proxy.clone())
        .or_insert_with(|| {
            let mut builder = ureq::AgentBuilder::new().redirects(0);
            if let Some(p) = proxy.as_deref().and_then(|p| ureq::Proxy::new(p).ok()) {
                builder = builder.proxy(p);
            }
            builder.build()
        })
        .clone()
}

const GETONLY_ENV: &str = "VOXGIG_GETONLY_GUARD";

// A GET-only live run refuses any other method before it is sent. The error
// names the path alone: the query can carry a credential.
fn getonly_refusal(fullurl: &str, method: &str) -> Option<ProjectNameError> {
    let method = method.to_uppercase();
    if std::env::var(GETONLY_ENV).ok().as_deref() != Some("TRUE") || method == "GET" {
        return None;
    }
    let rest = match fullurl.find("://") {
        Some(i) => {
            let auth = &fullurl[i + 3..];
            &auth[auth.find(|c| matches!(c, '/' | '?' | '#')).unwrap_or(auth.len())..]
        }
        None => fullurl,
    };
    let path = &rest[..rest.find(|c| matches!(c, '?' | '#')).unwrap_or(rest.len())];
    let path = if path.is_empty() { "/" } else { path };
    Some(ProjectNameError::new(
        "fetch_getonly_block",
        &format!("[GET-ONLY GUARD] blocked {} {}", method, path),
    ))
}

const REDIRECT_MAX: usize = 5;
const CREDENTIAL_HEADERS: [&str; 3] = ["authorization", "cookie", "proxy-authorization"];

// What another origin is not sent: the names every client drops, and
// whatever the SDK holds as a secret, by its name or by its value.
fn is_credential(ctx: &Rc<Context>, name: &str, value: &str) -> bool {
    CREDENTIAL_HEADERS.iter().any(|known| name.eq_ignore_ascii_case(known))
        || crate::utility::clean::clean_secret(ctx, name, value)
}

// The method a hop is made with, by ureq's own rule. After a 301, 302 or
// 303: a GET, unless the request was a GET or HEAD. After a 307 or 308: the
// same method, and only one that sends no body is followed.
fn redirect_method(status: u16, method: &str) -> Option<String> {
    let among = |names: &[&str]| names.iter().any(|name| method.eq_ignore_ascii_case(name));
    match status {
        301 | 302 | 303 if among(&["GET", "HEAD"]) => Some(method.to_string()),
        301 | 302 | 303 => Some("GET".to_string()),
        307 | 308 if among(&["GET", "HEAD", "OPTIONS", "TRACE"]) => Some(method.to_string()),
        _ => None,
    }
}

// Where a Location leads from the URL that answered with it, and whether
// that is another origin.
fn redirect_target(agent: &ureq::Agent, url: &str, location: &str) -> Option<(String, bool)> {
    let from = agent.request("GET", url).request_url().ok()?;
    let to = from.as_url().join(location).ok()?;
    let cross = to.origin() != from.as_url().origin();
    Some((to.to_string(), cross))
}

// Default live transport: ureq (blocking, minimal). A redirect is followed
// here: another origin is sent no credential, no hop carries the body, each
// hop passes the GET-only guard, and past REDIRECT_MAX hops the 3xx is the
// answer.
fn default_http_fetch(
    ctx: &Rc<Context>,
    fullurl: &str,
    fetchdef: &Value,
) -> Result<Value, ProjectNameError> {
    let mut method = get_str(fetchdef, "method")
        .filter(|m| !m.is_empty())
        .unwrap_or_else(|| "GET".to_string());
    if let Some(refused) = getonly_refusal(fullurl, &method) {
        return Err(refused);
    }

    let agent = agent_for(fetchdef);
    let manual = get_str(fetchdef, "redirect").as_deref() == Some("manual");

    let mut headers: Vec<(String, String)> = Vec::new();
    let sent_headers = getp(fetchdef, "headers");
    if let Value::Map(m) = &sent_headers {
        for (k, v) in m.borrow().iter() {
            if let Value::Str(sv) = v {
                headers.push((k.clone(), sv.clone()));
            }
        }
    }
    // Default User-Agent — some CDNs block library defaults. Use the project's
    // agent (main.kit.http.useragent, browser-shaped by default) unless the
    // caller already set one, and record it with the headers the request sent.
    if !headers.iter().any(|(k, _)| k.eq_ignore_ascii_case("user-agent")) {
        let agent = "PROJECTUSERAGENT";
        headers.push(("User-Agent".to_string(), agent.to_string()));
        if let Value::Map(_) = &sent_headers {
            setp(&sent_headers, "user-agent", Value::str(agent));
        }
    }

    let mut url = fullurl.to_string();
    let mut body =
        crate::utility::media::body_bytes(&getp(fetchdef, "body")).filter(|b| !b.is_empty());
    let mut hops = 0;

    let resp = loop {
        let mut req = agent.request(&method, &url);
        for (name, value) in &headers {
            req = req.set(name, value);
        }
        let sent = match &body {
            Some(bytes) => req.send_bytes(bytes),
            None => req.call(),
        };

        // ureq reports non-2xx as Err(Status) — unwrap those back into normal
        // responses so the result pipeline classifies them.
        let resp = match sent {
            Ok(r) => r,
            Err(ureq::Error::Status(_code, r)) => r,
            Err(e) => {
                return Err(ProjectNameError::new("fetch_transport", &format!("{}", e)));
            }
        };

        let hop = if manual || REDIRECT_MAX <= hops {
            None
        } else {
            resp.header("location").and_then(|location| {
                let next_method = redirect_method(resp.status(), &method)?;
                let (next, cross) = redirect_target(&agent, &url, location)?;
                Some((next_method, next, cross))
            })
        };
        let (next_method, next, cross) = match hop {
            Some(hop) => hop,
            None => break resp,
        };

        // No hop carries a body, so the headers that describe one go too.
        if body.is_some() || !next_method.eq_ignore_ascii_case(&method) {
            headers.retain(|(name, _)| !name.to_ascii_lowercase().starts_with("content-"));
        }
        if cross {
            headers.retain(|(name, value)| !is_credential(ctx, name, value));
        }
        if let Some(refused) = getonly_refusal(&next, &next_method) {
            return Err(refused);
        }

        url = next;
        method = next_method;
        body = None;
        hops += 1;
    };

    let status = resp.status() as i64;
    let status_text = resp.status_text().to_string();

    let headers = Value::empty_map();
    for name in resp.headers_names() {
        if let Some(val) = resp.header(&name) {
            setp(&headers, &name.to_lowercase(), Value::str(val));
        }
    }

    if crate::utility::media::is_raw_response(&ctx.point.borrow()) {
        return raw_response(ctx, resp, status, status_text, headers);
    }

    // ureq decodes gzip and no deflate, which a server may send whatever the
    // request asked for.
    let deflate = resp
        .header("content-encoding")
        .map(|v| v.trim().eq_ignore_ascii_case("deflate"))
        .unwrap_or(false);
    let body_txt = if deflate {
        read_deflate(resp.into_reader())?
    } else {
        resp.into_string()
            .map_err(|e| ProjectNameError::new("fetch_body", &format!("{}", e)))?
    };

    let parsed = if body_txt.trim().is_empty() {
        Ok(Value::Noval)
    } else {
        crate::utility::jsonparse::json_parse(&body_txt)
    };
    let unreadable = parsed.is_err();
    let json_body = parsed.unwrap_or(Value::Noval);

    Ok(jo(vec![
        ("status", Value::Num(status as f64)),
        ("statusText", Value::str(status_text)),
        ("headers", headers),
        ("json", json_thunk(json_body)),
        ("body", Value::str(body_txt)),
        ("unreadable", Value::Bool(unreadable)),
    ]))
}

// A raw body as its bytes, read no further than one byte past maxBuffer, and
// not at all when its declared length is already past it: the raw reader
// refuses either. Text stays a string; other bytes are a list of byte values.
fn raw_response(
    ctx: &Rc<Context>,
    resp: ureq::Response,
    status: i64,
    status_text: String,
    headers: Value,
) -> Result<Value, ProjectNameError> {
    use std::io::Read;
    let max = crate::utility::binary::max_buffer(ctx);
    let declared = resp.header("content-length").and_then(|v| v.trim().parse::<usize>().ok());
    let mut bytes: Vec<u8> = Vec::new();
    if declared.map_or(true, |n| n <= max) {
        resp.into_reader()
            .take(max as u64 + 1)
            .read_to_end(&mut bytes)
            .map_err(|e| ProjectNameError::new("fetch_body", &format!("{}", e)))?;
    }
    // A failure is read as any other: as JSON, else as unreadable.
    let (body, parsed) = match String::from_utf8(bytes) {
        Ok(text) => {
            let parsed = if text.trim().is_empty() {
                Ok(Value::Noval)
            } else {
                crate::utility::jsonparse::json_parse(&text)
            };
            (Value::str(text), parsed)
        }
        Err(e) => (crate::utility::media::bytes_value(e.as_bytes()), Ok(Value::Noval)),
    };
    let unreadable = parsed.is_err();
    Ok(jo(vec![
        ("status", Value::Num(status as f64)),
        ("statusText", Value::str(status_text)),
        ("headers", headers),
        ("json", json_thunk(parsed.unwrap_or(Value::Noval))),
        ("body", body),
        ("unreadable", Value::Bool(unreadable)),
    ]))
}

// A deflate body as text, bounded as ureq's into_string bounds one. Deflate is
// zlib-wrapped, or raw as some servers send it.
fn read_deflate(reader: impl std::io::Read) -> Result<String, ProjectNameError> {
    use std::io::Read;
    const LIMIT: usize = 10 * 1_024 * 1_024;
    let fail = |e: std::io::Error| {
        ProjectNameError::new("fetch_body", &format!("response body is not valid deflate data: {}", e))
    };
    let mut raw: Vec<u8> = Vec::new();
    reader.take((LIMIT + 1) as u64).read_to_end(&mut raw).map_err(fail)?;
    let zlib = raw.len() > 1
        && raw[0] & 0x0f == 8
        && ((u16::from(raw[0]) << 8) | u16::from(raw[1])) % 31 == 0;
    let mut out: Vec<u8> = Vec::new();
    if zlib {
        flate2::read::ZlibDecoder::new(&raw[..])
            .take((LIMIT + 1) as u64)
            .read_to_end(&mut out)
            .map_err(fail)?;
    } else {
        flate2::read::DeflateDecoder::new(&raw[..])
            .take((LIMIT + 1) as u64)
            .read_to_end(&mut out)
            .map_err(fail)?;
    }
    if out.len() > LIMIT {
        return Err(ProjectNameError::new("fetch_body", "response too big for into_string"));
    }
    Ok(String::from_utf8_lossy(&out).to_string())
}

pub fn fetcher_util(
    ctx: &Rc<Context>,
    fullurl: &str,
    fetchdef: &Value,
) -> Result<Value, ProjectNameError> {
    let client = ctx
        .client
        .borrow()
        .clone()
        .ok_or_else(|| ctx.make_error("fetch_no_client", "Expected context client."))?;

    let mode = client.mode.borrow().clone();
    if mode != "live" {
        return Err(ctx.make_error(
            "fetch_mode_block",
            &format!(
                "Request blocked by mode: \"{}\" (URL was: \"{}\")",
                mode, fullurl
            ),
        ));
    }

    let options = client.options_map();
    if getpath(&["feature", "test", "active"], &options) == Value::Bool(true) {
        return Err(ctx.make_error(
            "fetch_test_block",
            &format!(
                "Request blocked as test feature is active (URL was: \"{}\")",
                fullurl
            ),
        ));
    }

    let sys_fetch = getpath(&["system", "fetch"], &options);

    if sys_fetch.is_noval() || sys_fetch.is_null() {
        return default_http_fetch(ctx, fullurl, fetchdef);
    }

    if let Value::Func(_) = sys_fetch {
        // Caller-supplied transport: called with [url, fetchdef]; returns a
        // transport-shaped response map (an "__err__" entry signals failure).
        let out = call_vfn(
            &sys_fetch,
            &ja(vec![Value::str(fullurl), fetchdef.clone()]),
        );
        if let Some(msg) = get_str(&out, "__err__") {
            return Err(ctx.make_error("fetch_system", &msg));
        }
        return Ok(out);
    }

    Err(ctx.make_error("fetch_invalid", "system.fetch is not a valid function"))
}
