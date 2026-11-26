// A templated base URL takes each {name} from the `server` option. A missing
// or empty value refuses construction; test mode fills in test-<name>.

use RUSTCRATE::core::helpers::{get_str, jo};
use RUSTCRATE::{test_sdk, ProjectNameSDK, Value};

// A variable no API declares, so the API's own server defaults cannot fill it.
const BASE: &str = "https://api.example.test/bot{zzvar}";

fn base_of(sdk: &ProjectNameSDK) -> String {
    get_str(&sdk.options_map(), "base").unwrap_or_default()
}

#[test]
fn server_variable_missing_or_empty_refuses_construction() {
    for server in [Value::empty_map(), jo(vec![("zzvar", Value::str(""))])] {
        let err = match ProjectNameSDK::new(jo(vec![("base", Value::str(BASE)), ("server", server)])) {
            Ok(_) => panic!("construction should refuse without a value for zzvar"),
            Err(err) => err,
        };
        assert_eq!(err.code, "server_var_required");
        assert!(err.msg.contains("the server variable 'zzvar' is required"), "{}", err.msg);
        assert!(err.msg.contains(BASE), "{}", err.msg);
    }
}

#[test]
fn server_variable_fills_the_base() {
    let sdk = ProjectNameSDK::new(jo(vec![
        ("base", Value::str(BASE)),
        ("server", jo(vec![("zzvar", Value::str("T1"))])),
    ]))
    .unwrap();
    assert_eq!(base_of(&sdk), "https://api.example.test/botT1");
}

#[test]
fn server_variable_test_mode_fills_the_base() {
    let sdk = ProjectNameSDK::new(jo(vec![
        ("base", Value::str(BASE)),
        ("test", jo(vec![("active", Value::Bool(true))])),
    ]))
    .unwrap();
    assert_eq!(base_of(&sdk), "https://api.example.test/bottest-zzvar");

    let mock = test_sdk(Value::Noval, jo(vec![("base", Value::str(BASE))]));
    assert_eq!(base_of(&mock), "https://api.example.test/bottest-zzvar");
}
