// VENDORED: @voxgig/omni 0.2.0 (rust/src/lib.rs)
// Source: https://github.com/voxgig/omni @ ef55ad0fa48470146a81a1d652c859b03ebab6fc  [tag: sdk-20261127-1940-0]
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
