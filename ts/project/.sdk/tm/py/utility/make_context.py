# ProjectName SDK utility: make_context

from core.context import ProjectNameContext


def make_context_util(ctxmap, basectx):
    return ProjectNameContext(ctxmap, basectx)
