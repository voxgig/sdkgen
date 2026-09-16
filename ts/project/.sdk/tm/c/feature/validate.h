// The validate feature's public surface (feature/validate.c). A header of its
// own, like feature/secrets.h and for the same reason: a caller needs more
// than the constructor sdk.h's list gives every bundled feature. Here it is
// the `onInvalid` callback, which the model types a `$FUNCTION` and a C
// option value cannot hold - so it is set on the feature after construction,
// the way the retry port takes its injectable sleep.
//
// The feature is GATED (model/feature/validate.aon `needs: { schema: true }`
// and model/target/c.aon `provides`), so its constructor is NOT in sdk.h's
// bundled list: core/config.c emits the prototype for a project that selected
// it, and this header repeats it for a caller that includes only this file.

#ifndef PROJECTNAME_FEATURE_VALIDATE_H
#define PROJECTNAME_FEATURE_VALIDATE_H

#include "sdk.h"

Feature* feature_validate_new(void);

// Called with a report map for every failure, whatever `mode` does with it,
// so a client can log or count invalid payloads without changing what the SDK
// returns. The report carries `entity`, `op`, `direction` ("request" or
// "response"), `errs` (a list of messages) and `data` (what was checked); it
// is owned by the SDK and must not be released by the callback.
typedef void (*ValidateReportFn)(voxgig_value* report, void* ud);

void feature_validate_on_invalid(Feature* f, ValidateReportFn fn, void* ud);

#endif // PROJECTNAME_FEATURE_VALIDATE_H
