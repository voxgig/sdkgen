use std::cell::RefCell;
use std::rc::Rc;

use crate::core::control::Transfer;
use crate::core::error::ProjectNameError;
use crate::core::helpers::{getp, jo};
use crate::core::types::{OpWith, ProjectNameEntityBase};
use crate::utility::binary::BinarySource;
use crate::utility::media::RAW_BODY;
use crate::utility::voxgigstruct::Value;

// A slot the entity component derived from the model: the action whose
// points move its bytes ('' for the entity's own), and the operations that
// read and write them.
pub struct BinarySlot {
    pub name: &'static str,
    pub action: &'static str,
    pub read: Option<&'static str>,
    pub write: Option<&'static str>,
}

// An entity's named bytes. Each call is one run of the entity's own
// operation on the slot's point; in core only whole, in-memory bodies move.
pub struct BinaryHandle<E: ProjectNameEntityBase> {
    entity: Rc<E>,
    slot: String,
    def: Option<&'static BinarySlot>,
}

impl<E: ProjectNameEntityBase> BinaryHandle<E> {
    pub fn new(entity: Rc<E>, slots: &'static [BinarySlot], slot: &str) -> BinaryHandle<E> {
        BinaryHandle {
            entity,
            slot: slot.to_string(),
            def: slots.iter().find(|s| s.name == slot),
        }
    }

    pub fn name(&self) -> &str {
        &self.slot
    }

    // The whole body, within maxBuffer. `opts` takes no key in core but
    // `range`, which needs the binary feature.
    pub fn bytes(&self, opts: Value, ctrl: Value) -> Result<Vec<u8>, ProjectNameError> {
        if !getp(&opts, "range").is_nullish() {
            return Err(self.inactive("read a range"));
        }
        let def = self.direction("read")?;
        let transfer = self.transfer("read");
        self.entity.load_with(
            self.select(def),
            ctrl,
            OpWith { sources: Vec::new(), transfer: Some(transfer.clone()) },
        )?;
        let bytes = transfer.borrow_mut().bytes.take();
        Ok(bytes.unwrap_or_default())
    }

    // Sends in-memory content as the slot's body; resolves to the entity.
    pub fn put(&self, source: BinarySource, ctrl: Value) -> Result<Rc<E>, ProjectNameError> {
        let def = self.direction("write")?;
        let opwith = OpWith {
            sources: vec![(RAW_BODY.to_string(), source)],
            transfer: Some(self.transfer("write")),
        };
        let data = self.select(def);
        match def.write {
            Some("create") => self.entity.create_with(data, ctrl, opwith),
            Some("patch") => self.entity.patch_with(data, ctrl, opwith),
            _ => self.entity.update_with(data, ctrl, opwith),
        }
    }

    pub fn save(&self) -> Result<(), ProjectNameError> {
        Err(self.inactive("save"))
    }

    pub fn stream(&self) -> Result<(), ProjectNameError> {
        Err(self.inactive("stream"))
    }

    pub fn open(&self) -> Result<(), ProjectNameError> {
        Err(self.inactive("open"))
    }

    fn transfer(&self, direction: &str) -> Rc<RefCell<Transfer>> {
        Rc::new(RefCell::new(Transfer {
            slot: self.slot.clone(),
            direction: direction.to_string(),
            bytes: None,
        }))
    }

    fn select(&self, def: &BinarySlot) -> Value {
        if def.action.is_empty() {
            Value::empty_map()
        } else {
            jo(vec![("$action", Value::str(def.action))])
        }
    }

    fn direction(&self, way: &str) -> Result<&'static BinarySlot, ProjectNameError> {
        let def = self.def.ok_or_else(|| {
            ProjectNameError::new(
                "binary_slot_unknown",
                &format!(
                    "Entity \"{}\" has no binary slot \"{}\".",
                    self.entity.get_name(),
                    self.slot
                ),
            )
        })?;
        let op = if "read" == way { def.read } else { def.write };
        if op.is_none() {
            return Err(ProjectNameError::new(
                "binary_slot_direction",
                &format!(
                    "The binary slot \"{}\" of entity \"{}\" cannot be {}.",
                    self.slot,
                    self.entity.get_name(),
                    if "read" == way { "read" } else { "written" }
                ),
            ));
        }
        Ok(def)
    }

    fn inactive(&self, what: &str) -> ProjectNameError {
        ProjectNameError::new(
            "binary_feature_inactive",
            &format!(
                "The binary slot \"{}\" of entity \"{}\" cannot {} without the binary \
                 feature; in core it answers bytes() and put().",
                self.slot,
                self.entity.get_name(),
                what
            ),
        )
    }
}
