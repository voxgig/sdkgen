// Every form, multipart and raw point this SDK has, driven through a real
// entity operation against a local listener that decodes what arrives. The
// cases come from the client's own config; the entities they run on come
// from the generated table in codec_entities.

#![allow(dead_code)]

mod codec_entities;

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::{Arc, Mutex};

use codec_entities::{entity, new_client, CodecEntity};
use RUSTCRATE::core::helpers::{get_str, getp, jo, setp};
use RUSTCRATE::{make_config, BinarySource, OpWith, Value};

#[derive(Clone, Default)]
struct Answer {
    ty: String,
    body: Vec<u8>,
}

#[derive(Clone)]
struct Arrived {
    method: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

impl Arrived {
    fn header(&self, name: &str) -> String {
        self.headers
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.clone())
            .unwrap_or_default()
    }
}

#[derive(Clone)]
struct Net {
    answer: Arc<Mutex<Answer>>,
    arrivals: Arc<Mutex<Vec<Arrived>>>,
}

impl Net {
    fn answer(&self, ty: &str, body: &[u8]) {
        *self.answer.lock().unwrap() = Answer { ty: ty.to_string(), body: body.to_vec() };
    }

    fn arrived(&self) -> Arrived {
        let all = self.arrivals.lock().unwrap();
        assert!(!all.is_empty(), "nothing arrived");
        all[all.len() - 1].clone()
    }
}

fn serve(stream: TcpStream, net: &Net) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut line = String::new();
    reader.read_line(&mut line)?;
    let method = line.split(' ').next().unwrap_or("").to_string();
    let mut headers = Vec::new();
    loop {
        let mut h = String::new();
        reader.read_line(&mut h)?;
        let h = h.trim_end().to_string();
        if h.is_empty() {
            break;
        }
        if let Some((k, v)) = h.split_once(':') {
            headers.push((k.trim().to_lowercase(), v.trim().to_string()));
        }
    }
    let length = headers
        .iter()
        .find(|(k, _)| k == "content-length")
        .and_then(|(_, v)| v.parse::<usize>().ok())
        .unwrap_or(0);
    let mut body = vec![0u8; length];
    reader.read_exact(&mut body)?;
    net.arrivals.lock().unwrap().push(Arrived { method, headers, body });

    let answer = net.answer.lock().unwrap().clone();
    let ty = if answer.ty.is_empty() { "application/json".to_string() } else { answer.ty };
    let mut out = stream;
    write!(
        out,
        "HTTP/1.1 200 OK\r\ncontent-type: {}\r\ncontent-length: {}\r\nconnection: close\r\n\r\n",
        ty,
        answer.body.len()
    )?;
    out.write_all(&answer.body)?;
    out.flush()
}

fn listen() -> (String, Net) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("a local listener");
    let base = format!("http://{}", listener.local_addr().unwrap());
    let net = Net { answer: Arc::default(), arrivals: Arc::default() };
    let served = net.clone();
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let _ = serve(stream, &served);
        }
    });
    (base, net)
}

fn content(name: &str) -> Vec<u8> {
    let mut out = format!("file:{}", name).into_bytes();
    out.extend_from_slice(&[0, 0xFF, b'\r', b'\n', b'-', b'-']);
    out
}

fn strs(val: &Value) -> Vec<Value> {
    match val {
        Value::List(l) => l.borrow().clone(),
        _ => Vec::new(),
    }
}

fn keys(val: &Value) -> Vec<String> {
    match val {
        Value::Map(m) => {
            let mut k: Vec<String> = m.borrow().keys().cloned().collect();
            k.sort();
            k
        }
        _ => Vec::new(),
    }
}

// A value for each path parameter a point names, and the point's action.
fn params(point: &Value) -> Value {
    let out = Value::empty_map();
    for part in strs(&getp(point, "parts")) {
        if let Value::Str(s) = part {
            if s.starts_with('{') && s.ends_with('}') && 2 < s.len() {
                setp(&out, &s[1..s.len() - 1], Value::str("p1"));
            }
        }
    }
    out
}

fn action(point: &Value) -> Option<String> {
    get_str(&getp(point, "select"), "$action")
}

fn args(point: &Value) -> Value {
    let out = params(point);
    if let Some(a) = action(point) {
        setp(&out, "$action", Value::str(a));
    }
    out
}

#[derive(Debug, PartialEq)]
enum Part {
    Text(String, Vec<u8>),
    File(String, Vec<u8>, Option<String>, Option<String>),
}

fn part_name(p: &Part) -> &str {
    match p {
        Part::Text(n, _) | Part::File(n, _, _, _) => n,
    }
}

// The data a form or multipart point is sent, the sources beside it, and the
// parts it must arrive as.
fn plan(body: &Value) -> (Value, OpWith, Vec<Part>) {
    let kind = get_str(body, "kind").unwrap_or_default();
    let data = Value::empty_map();
    let mut sources = Vec::new();
    let mut expect = Vec::new();
    for field in strs(&getp(body, "fields")) {
        let name = match get_str(&field, "name") {
            Some(n) => n,
            None => continue,
        };
        if getp(&field, "binary") == Value::Bool(true) {
            let ty = if "form" == kind {
                None
            } else {
                Some(get_str(&field, "media").unwrap_or("application/octet-stream".to_string()))
            };
            sources.push((
                name.clone(),
                BinarySource::bytes(content(&name), Some(&format!("/local/dir/{}.bin", name)), ty.as_deref()),
            ));
            expect.push(if "form" == kind {
                Part::Text(name.clone(), content(&name))
            } else {
                Part::File(name.clone(), content(&name), Some(format!("{}.bin", name)), ty)
            });
        } else if getp(&field, "list") == Value::Bool(true) {
            setp(&data, &name, Value::list(vec![Value::str("a"), Value::str("b c")]));
            expect.push(Part::Text(name.clone(), b"a".to_vec()));
            expect.push(Part::Text(name.clone(), b"b c".to_vec()));
        } else if let Some(join) = get_str(&field, "join") {
            setp(&data, &name, Value::list(vec![Value::str("a"), Value::str("b")]));
            expect.push(Part::Text(name.clone(), format!("a{}b", join).into_bytes()));
        } else {
            let v = format!("v\"{}\r\n", name);
            setp(&data, &name, Value::str(v.clone()));
            expect.push(Part::Text(name.clone(), v.into_bytes()));
        }
    }
    (data, OpWith::sources(sources), expect)
}

fn unhex(c: u8) -> u8 {
    (c as char).to_digit(16).unwrap_or(0) as u8
}

fn form_decode(text: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < text.len() {
        match text[i] {
            b'+' => out.push(b' '),
            b'%' if i + 2 < text.len() => {
                out.push(unhex(text[i + 1]) * 16 + unhex(text[i + 2]));
                i += 2;
            }
            c => out.push(c),
        }
        i += 1;
    }
    out
}

fn form_parts(body: &[u8]) -> Vec<Part> {
    if body.is_empty() {
        return Vec::new();
    }
    body.split(|b| b'&' == *b)
        .map(|pair| {
            let at = pair.iter().position(|b| b'=' == *b).unwrap_or(pair.len());
            let name = String::from_utf8_lossy(&form_decode(&pair[..at])).to_string();
            let value = if at < pair.len() { form_decode(&pair[at + 1..]) } else { Vec::new() };
            Part::Text(name, value)
        })
        .collect()
}

fn find(hay: &[u8], needle: &[u8], from: usize) -> Option<usize> {
    if needle.len() > hay.len() {
        return None;
    }
    (from..=hay.len() - needle.len()).find(|&i| &hay[i..i + needle.len()] == needle)
}

fn multipart_parts(arrived: &Arrived) -> Vec<Part> {
    let ty = arrived.header("content-type");
    let boundary = ty.split("boundary=").nth(1).expect("no boundary in the content type");
    let boundary = boundary.split(';').next().unwrap().to_string();
    let body = &arrived.body;
    let delim = format!("--{}", boundary).into_bytes();
    let close = format!("--{}--\r\n", boundary).into_bytes();
    assert!(body.ends_with(&close), "the body does not close");

    let mut parts = Vec::new();
    let mut at = find(body, &delim, 0).expect("no first delimiter");
    loop {
        let start = at + delim.len();
        if body[start..].starts_with(b"--") {
            break;
        }
        let next = find(body, &delim, start).expect("an unterminated part");
        let chunk = &body[start + 2..next - 2];
        let split = find(chunk, b"\r\n\r\n", 0).expect("a part without a blank line");
        let head = String::from_utf8_lossy(&chunk[..split]).to_string();
        let content = chunk[split + 4..].to_vec();
        let mut name = String::new();
        let mut filename = None;
        let mut ctype = None;
        for line in head.split("\r\n") {
            if let Some(disp) = line.strip_prefix("Content-Disposition: form-data; ") {
                for param in disp.split("; ") {
                    if let Some(v) = param.strip_prefix("name=") {
                        name = v.trim_matches('"').to_string();
                    }
                    if let Some(v) = param.strip_prefix("filename=") {
                        filename = Some(v.trim_matches('"').to_string());
                    }
                }
            } else if let Some(t) = line.strip_prefix("Content-Type: ") {
                ctype = Some(t.to_string());
            } else {
                panic!("a part header that is not allowed: {:?}", line);
            }
        }
        parts.push(match filename {
            Some(_) => Part::File(name, content, filename, ctype),
            None => Part::Text(name, content),
        });
        at = next;
    }
    parts
}

fn code(res: Result<impl Sized, RUSTCRATE::ProjectNameError>) -> String {
    match res {
        Ok(_) => "ok".to_string(),
        Err(e) => e.code,
    }
}

type Run = Box<dyn Fn(&str, &Net)>;

struct Case {
    name: String,
    run: Run,
}

fn ent(base: &str, ename: &str) -> CodecEntity {
    let client = new_client(jo(vec![("base", Value::str(base))]));
    entity(&client, ename).expect("the generated codec table names the entity")
}

fn cases() -> Vec<Case> {
    let config = make_config();
    let mut out: Vec<Case> = Vec::new();

    for ename in keys(&getp(&config, "entity")) {
        let ops = getp(&getp(&getp(&config, "entity"), &ename), "op");
        for opname in keys(&ops) {
            for point in strs(&getp(&getp(&ops, &opname), "points")) {
                let label = format!(
                    "{}.{}{}",
                    ename,
                    opname,
                    action(&point).map(|a| format!(":{}", a)).unwrap_or_default()
                );
                let rb = getp(&point, "body");
                let rs = getp(&point, "response");
                let rbkind = get_str(&rb, "kind").unwrap_or_default();
                let writes = ["create", "update", "patch"].contains(&opname.as_str());

                if ("form" == rbkind || "multipart" == rbkind) && writes {
                    let (ename, opname, point, rb) =
                        (ename.clone(), opname.clone(), point.clone(), rb.clone());
                    out.push(Case {
                        name: format!("{} sends a {} body", label, rbkind),
                        run: Box::new(move |base, net| {
                            let e = ent(base, &ename);
                            let (data, opwith, expect) = plan(&rb);
                            let a = args(&point);
                            for k in keys(&data) {
                                setp(&a, &k, getp(&data, &k));
                            }
                            net.answer("application/json", b"{\"id\":\"p1\"}");
                            (e.op)(&opname, a, Value::Noval, opwith).expect("the operation");
                            let arrived = net.arrived();
                            let got = if Some("form".to_string()) == get_str(&rb, "kind") {
                                assert_eq!(arrived.header("content-type"), get_str(&rb, "media").unwrap());
                                form_parts(&arrived.body)
                            } else {
                                multipart_parts(&arrived)
                            };
                            let got: Vec<Part> = got
                                .into_iter()
                                .filter(|g| expect.iter().any(|x| part_name(x) == part_name(g)))
                                .collect();
                            assert_eq!(got, expect);
                        }),
                    });
                }

                if "raw" == rbkind && writes {
                    let binary = getp(&rb, "binary") == Value::Bool(true);
                    let (ename, opname, point, rb, label2) =
                        (ename.clone(), opname.clone(), point.clone(), rb.clone(), label.clone());
                    out.push(Case {
                        name: format!("{} sends a raw {} body", label, if binary { "binary" } else { "text" }),
                        run: Box::new(move |base, net| {
                            let e = ent(base, &ename);
                            net.answer("application/json", b"{\"id\":\"p1\"}");
                            (e.set)(params(&point));
                            let media = get_str(&rb, "media").unwrap_or_default();
                            if binary {
                                let slot = action(&point).unwrap_or_default();
                                let put = e.put.as_ref().expect("an entity with a binary slot");
                                let src = BinarySource::bytes(content(&label2), None, Some(&media));
                                assert!(put(&slot, src, Value::Noval).expect("put"), "put resolves to the entity");
                                assert_eq!(net.arrived().body, content(&label2));
                            } else {
                                let text = format!("text \"{}\"\n", label2);
                                let a = Value::empty_map();
                                if let Some(act) = action(&point) {
                                    setp(&a, "$action", Value::str(act));
                                }
                                setp(&a, "$body", Value::str(text.clone()));
                                (e.op)(&opname, a, Value::Noval, OpWith::default()).expect("the operation");
                                assert_eq!(net.arrived().body, text.into_bytes());
                            }
                            assert_eq!(net.arrived().header("content-type"), media);
                        }),
                    });
                }

                if Some("raw".to_string()) == get_str(&rs, "kind") && "load" == opname {
                    let binary = getp(&rs, "binary") == Value::Bool(true);
                    let (ename, point, rs, label2) =
                        (ename.clone(), point.clone(), rs.clone(), label.clone());
                    out.push(Case {
                        name: format!("{} reads a raw {} body", label, if binary { "binary" } else { "text" }),
                        run: Box::new(move |base, net| {
                            let e = ent(base, &ename);
                            (e.set)(params(&point));
                            let media = get_str(&rs, "media").unwrap_or_default();
                            if binary {
                                net.answer(&media, &content(&label2));
                                let slot = action(&point).unwrap_or_default();
                                let bytes = e.bytes.as_ref().expect("an entity with a binary slot");
                                assert_eq!(bytes(&slot, Value::Noval, Value::Noval).expect("bytes"), content(&label2));
                                let refused = (e.op)("load", args(&point), Value::Noval, OpWith::default());
                                assert_eq!(code(refused), "binary_sink_required");
                            } else {
                                let text = format!("café {}", label2);
                                net.answer(&media, text.as_bytes());
                                let data = (e.op)("load", args(&point), Value::Noval, OpWith::default())
                                    .expect("the operation");
                                assert_eq!(getp(&data, "$body"), Value::str(text));
                            }
                        }),
                    });
                }
            }
        }

        if let Some(e) = entity(&new_client(Value::Noval), &ename) {
            if let (Some(_), Some(_)) = (&e.inactive, &e.bytes) {
                let ename = ename.clone();
                out.push(Case {
                    name: format!("{} refuses what needs the binary feature", ename),
                    run: Box::new(move |base, _net| {
                        let e = ent(base, &ename);
                        let inactive = e.inactive.as_ref().unwrap();
                        for res in inactive("") {
                            assert_eq!(code(res), "binary_feature_inactive");
                        }
                        let bytes = e.bytes.as_ref().unwrap();
                        let put = e.put.as_ref().unwrap();
                        let range = jo(vec![("range", Value::str("bytes=0-1"))]);
                        assert_eq!(code(bytes("", range, Value::Noval)), "binary_feature_inactive");
                        if e.named {
                            assert_eq!(code(bytes("nope", Value::Noval, Value::Noval)), "binary_slot_unknown");
                        }
                        for (slot, read, write) in &e.slots {
                            if !read {
                                assert_eq!(code(bytes(slot, Value::Noval, Value::Noval)), "binary_slot_direction");
                            }
                            if !write {
                                let src = BinarySource::bytes("x", None, None);
                                assert_eq!(code(put(slot, src, Value::Noval)), "binary_slot_direction");
                            }
                        }
                    }),
                });
            }
        }
    }
    out
}

#[test]
fn codec_points_round_trip() {
    let cases = cases();
    assert!(!cases.is_empty(), "no form, multipart or raw point was found");

    let (base, net) = listen();
    let mut ran = 0;
    let mut failed = 0;
    for case in &cases {
        ran += 1;
        net.arrivals.lock().unwrap().clear();
        *net.answer.lock().unwrap() = Answer::default();
        let outcome = catch_unwind(AssertUnwindSafe(|| (case.run)(&base, &net)));
        if outcome.is_err() {
            failed += 1;
            eprintln!("codec: FAILED {}", case.name);
        } else {
            println!("codec: ok {}", case.name);
        }
    }
    println!("codec: ran {} case(s), {} failed", ran, failed);
    assert_eq!(0, failed, "codec cases failed");
}
