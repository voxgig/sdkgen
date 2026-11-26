// VENDORED: @voxgig/struct 0.1.3 (c/src/value_io.h)
// Source: https://github.com/voxgig/struct @ 358af9d51c90b589a295a70b2165dbe4629eaf8e  [tag: sdk-20261125-1959-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
/* Copyright (c) 2025-2026 Voxgig Ltd. MIT LICENSE.
 *
 * Voxgig Struct — JSON I/O bridge.
 *
 * Hand-written recursive-descent JSON parser (no third-party deps).
 * Runtime values use voxgig_value.
 */

#ifndef VOXGIG_STRUCT_VALUE_IO_H
#define VOXGIG_STRUCT_VALUE_IO_H

#include "value.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Parse a JSON text. Returns a new voxgig_value (owned by caller): undef for
 * malformed input, including anything but whitespace after the value. */
voxgig_value* voxgig_parse_json(const char* text, size_t len);

/* Parse a JSON file. */
voxgig_value* voxgig_parse_json_file(const char* path);

/* Serialise to JSON text. Returns malloc'd string the caller must free(). */
char* voxgig_to_json(const voxgig_value* v);

#ifdef __cplusplus
}
#endif

#endif
