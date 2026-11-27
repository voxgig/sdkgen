use std::cell::RefCell;
use std::rc::Rc;

use crate::core::error::ProjectNameError;
use crate::utility::voxgigstruct::Value;

pub struct Control {
    pub throw: Option<bool>,
    pub err: Option<ProjectNameError>,
    // explain / paging are Value maps when supplied (Noval otherwise). They
    // are the caller's own maps (reference-shared), so recorded entries are
    // visible to the caller after the operation completes.
    pub explain: Value,
    pub actor: String,
    pub paging: Value,
    // Set by an entity's binary handle: the slot and the direction its bytes move.
    pub transfer: Option<Rc<RefCell<Transfer>>>,
}

pub struct Transfer {
    pub slot: String,
    pub direction: String,
    pub bytes: Option<Vec<u8>>,
}

impl Control {
    pub fn new() -> Control {
        Control {
            throw: None,
            err: None,
            explain: Value::Noval,
            actor: String::new(),
            paging: Value::Noval,
            transfer: None,
        }
    }

    pub fn has_explain(&self) -> bool {
        matches!(self.explain, Value::Map(_))
    }
}

impl Default for Control {
    fn default() -> Control {
        Control::new()
    }
}
