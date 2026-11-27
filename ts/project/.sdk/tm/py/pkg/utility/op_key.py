# ProjectName SDK utility: op_key

from __future__ import annotations


# The custom action a call names: `$action` in its own request argument,
# never in a response.
def op_action(ctx):
    op = getattr(ctx, "op", None)
    if op is not None and "data" == getattr(op, "input", None):
        req = getattr(ctx, "reqdata", None)
    else:
        req = getattr(ctx, "reqmatch", None)
    action = req.get("$action") if isinstance(req, dict) else None
    return action if isinstance(action, str) and "" != action else None


# The keys an operation is looked up and filed by, most specific first:
# `<entity>.<op>:<action>`, `<entity>.<op>`, `<op>`, `*`.
def op_keys(ctx):
    op = getattr(ctx, "op", None)
    name = (getattr(op, "name", None) if op is not None else None) or "_"
    entity = getattr(op, "entity", None) if op is not None else None
    if not entity:
        ent = getattr(ctx, "entity", None)
        get_name = getattr(ent, "get_name", None)
        entity = get_name() if callable(get_name) else None
    base = (entity or "_") + "." + name
    action = op_action(ctx)
    if action is None:
        return [base, name, "*"]
    return [base + ":" + action, base, name, "*"]


# The name a call is filed under where a consumer reads it: the first key,
# with the action cleaned.
def op_file_key(ctx):
    keys = op_keys(ctx)
    action = op_action(ctx)
    if action is None:
        return keys[0]
    utility = getattr(ctx, "utility", None)
    clean = getattr(utility, "clean", None)
    if callable(clean):
        out = clean(ctx, {"action": action})
        if isinstance(out, dict) and isinstance(out.get("action"), str):
            action = out["action"]
    return keys[1] + ":" + action
