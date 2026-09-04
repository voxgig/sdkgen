# VENDORED: @voxgig/omni 0.1.0 (python/voxgig_omni/__init__.py)
# Source: https://github.com/voxgig/omni @ 8c3e1b573a8d35796f7fc45e3226b977023cabf7  [tag: sdk-20260904-1610-0]
# License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
"""voxgig_omni - shared multi-language test runner."""

from .runner import (
    CAPABILITIES,
    EXISTSMARK,
    NULLMARK,
    SPECVERSION,
    UNDEFMARK,
    OmniError,
    errify,
    fixjson,
    loadspec,
    makeRunner,
    match,
    matchval,
    nullmodifier,
    resolvespec,
)
from .util import (
    ABSENT,
    clone,
    deepequal,
    getpath,
    islist,
    ismap,
    isnode,
    jsonstr,
    pathify,
    stringify,
    walk,
)

__all__ = [
    'ABSENT',
    'CAPABILITIES',
    'EXISTSMARK',
    'NULLMARK',
    'SPECVERSION',
    'UNDEFMARK',
    'OmniError',
    'clone',
    'deepequal',
    'errify',
    'fixjson',
    'getpath',
    'islist',
    'ismap',
    'isnode',
    'jsonstr',
    'loadspec',
    'makeRunner',
    'match',
    'matchval',
    'nullmodifier',
    'pathify',
    'resolvespec',
    'stringify',
    'walk',
]
