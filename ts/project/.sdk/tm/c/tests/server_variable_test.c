// A templated base URL takes each {name} from the `server` option. A missing
// or empty value refuses construction; test mode fills in test-<name>.

#include "ctest.h"

#include <stdlib.h>

// A variable no API declares, so the API's own server defaults cannot fill it.
#define BASE "https://api.example.test/bot{zzvar}"

static const char* base_of(ProjectNameSDK* sdk) {
  return get_str(sdk_options_map(sdk), "base");
}

int main(void) {
  voxgig_value* servers[2] = { v_map(), cmap(1, "zzvar", v_str("")) };
  for (int i = 0; i < 2; i++) {
    PNError* err = NULL;
    ProjectNameSDK* refused = projectname_sdk_new(
      cmap(2, "base", v_str(BASE), "server", servers[i]), &err);
    CHECK(NULL == refused, "construction refuses without a value for zzvar");
    CHECK(err && 0 == strcmp(err->code, "server_var_required"), "the error carries its code");
    CHECK(err && strstr(err->msg, "the server variable 'zzvar' is required"),
          "the error names the variable");
    CHECK(err && strstr(err->msg, BASE), "the error quotes the base URL");
  }

  ProjectNameSDK* filled = projectname_sdk_new(cmap(2,
    "base", v_str(BASE), "server", cmap(1, "zzvar", v_str("T1"))), NULL);
  CHECK_STR_EQ(base_of(filled), "https://api.example.test/botT1", "a server value fills the base");

  ProjectNameSDK* testmode = projectname_sdk_new(cmap(2,
    "base", v_str(BASE), "test", cmap(1, "active", v_bool(true))), NULL);
  CHECK_STR_EQ(base_of(testmode), "https://api.example.test/bottest-zzvar",
               "the test option fills test-<name>");

  ProjectNameSDK* mock = test_sdk(NULL, cmap(1, "base", v_str(BASE)));
  CHECK_STR_EQ(base_of(mock), "https://api.example.test/bottest-zzvar",
               "the test feature fills test-<name>");

  TEST_SUMMARY("server_variable_test");
}
