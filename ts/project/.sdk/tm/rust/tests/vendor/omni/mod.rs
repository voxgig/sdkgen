// VENDORED: @voxgig/omni 0.1.0 (rust/src/lib.rs)
// Source: https://github.com/voxgig/omni @ e9cb45a308a4da47ffdbc1b3149b9c59199190b2  [tag: sdk-20261016-0845-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
pub mod json;
pub mod regex;
pub mod runner;
pub mod util;

pub use json::{parse, Json};
pub use regex::Regex;
pub use runner::{
    errify, fixjson, loadspec, make_runner, matchcheck, matchval, nullmodifier, numtext,
    resolvespec, Flags, OmniError, Provider, RunPack, Runner, SpecRef, Subject, SubjectArgs,
    CAPABILITIES,
    SPECVERSION,
};
pub use util::{
    clone, deepequal, getpath, jsonstr, numstr, pathify, stringify, walk, EXISTSMARK, NULLMARK,
    UNDEFMARK,
};
