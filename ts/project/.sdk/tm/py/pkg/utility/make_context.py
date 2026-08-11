# ProjectName SDK utility: make_context

from projectname_sdk.core.context import ProjectNameContext


def make_context_util(ctxmap, basectx):
    return ProjectNameContext(ctxmap, basectx)
