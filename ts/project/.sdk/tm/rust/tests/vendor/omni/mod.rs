// VENDORED: @voxgig/omni sdk-20261009-0906-0 (rust/src/lib.rs)
// Source: https://github.com/voxgig/omni @ 5ab24080fb06b45bbbbc3814522bda7da30b520b  [tag: sdk-20261009-0906-0]
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
