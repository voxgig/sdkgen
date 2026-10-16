// VENDORED: @voxgig/sekreto 0.1.0 (rust/src/lib.rs)
// Source: https://github.com/voxgig/sekreto @ ee837130bf444ca46a5a46181bdd6743e118898c  [tag: sdk-20261016-0845-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.

pub mod addr;
pub mod providers;
pub mod sekreto;

pub use self::addr::{checkaddr, safeaddr};
pub use self::providers::{
    builtins, optionsof, providerplugin, specof, AuthSpec, DotenvProvider, EnvProvider,
    FileProvider, MemoryProvider, Provider, ProviderSpec, BUILTIN_KINDS, ERROR_CODE, PLUGIN_KINDS,
    PROVIDER_EXPORT,
};
pub use self::sekreto::{
    awsparam, checkname, envkey, flatname, parsedotenv, redact, storename, validname, vaultref,
    Answer, ChainError, Options, Sekreto, SekretoError, VaultRef,
};

/// voxgig/plugin, re-exported: a consumer builds a custom kind with
/// `providerplugin` and never needs to name the dependency itself.
pub use super::plugin as voxgig_plugin;
