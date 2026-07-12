// ProjectNameError: the SDK error type (mirrors go core/error.go). The
// pipeline error discipline is Result<T, ProjectNameError> throughout.

use crate::utility::voxgigstruct::Value;

#[derive(Clone, Debug)]
pub struct ProjectNameError {
    pub sdk: String,
    pub code: String,
    pub msg: String,
    // Cleaned snapshots attached by makeError (Noval until then).
    pub result: Value,
    pub spec: Value,
}

impl ProjectNameError {
    pub fn new(code: &str, msg: &str) -> ProjectNameError {
        ProjectNameError {
            sdk: "ProjectName".to_string(),
            code: code.to_string(),
            msg: msg.to_string(),
            result: Value::Noval,
            spec: Value::Noval,
        }
    }
}

impl std::fmt::Display for ProjectNameError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.msg)
    }
}

impl std::error::Error for ProjectNameError {}
