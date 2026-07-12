package JAVAPACKAGE.entity;

import java.util.LinkedHashMap;
import java.util.Map;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.Helpers;
import JAVAPACKAGE.core.SdkClient;
import JAVAPACKAGE.core.SdkEntity;
import JAVAPACKAGE.core.Utility;
import JAVAPACKAGE.utility.struct.Struct;

/**
 * Shared entity runtime for the ProjectName SDK: accreting data/match
 * state, the entity context, and the operation pipeline (runOp) with its
 * feature hooks. Generated entity classes extend this.
 */
@SuppressWarnings({"unchecked"})
public abstract class EntityBase implements SdkEntity {

  protected String name = "";
  protected SdkClient client;
  protected Utility utility;
  protected Map<String, Object> entopts;
  protected Map<String, Object> data = new LinkedHashMap<>();
  protected Map<String, Object> match = new LinkedHashMap<>();
  protected Context entctx;

  protected EntityBase(String name, SdkClient client, Map<String, Object> entopts) {
    if (entopts == null) {
      entopts = new LinkedHashMap<>();
    }
    if (!entopts.containsKey("active")) {
      entopts.put("active", true);
    }
    else if (Boolean.FALSE.equals(entopts.get("active"))) {
      // keep false
    }
    else {
      entopts.put("active", true);
    }

    this.name = name;
    this.client = client;
    this.utility = client.getUtility();
    this.entopts = entopts;

    Map<String, Object> ctxmap = new LinkedHashMap<>();
    ctxmap.put("entity", this);
    ctxmap.put("entopts", entopts);
    this.entctx = this.utility.makeContext.apply(ctxmap, client.getRootCtx());

    this.utility.featureHook.apply(this.entctx, "PostConstructEntity");
  }

  @Override
  public String getName() {
    return this.name;
  }

  @Override
  public Object data(Object... args) {
    if (args.length > 0 && args[0] != null) {
      Map<String, Object> d = Helpers.toMapAny(Struct.clone(args[0]));
      this.data = d == null ? new LinkedHashMap<>() : d;
      this.utility.featureHook.apply(this.entctx, "SetData");
    }

    this.utility.featureHook.apply(this.entctx, "GetData");
    return Struct.clone(this.data);
  }

  @Override
  public Object match(Object... args) {
    if (args.length > 0 && args[0] != null) {
      Map<String, Object> m = Helpers.toMapAny(Struct.clone(args[0]));
      this.match = m == null ? new LinkedHashMap<>() : m;
      this.utility.featureHook.apply(this.entctx, "SetMatch");
    }

    this.utility.featureHook.apply(this.entctx, "GetMatch");
    return Struct.clone(this.match);
  }

  // runOp drives one operation through the pipeline: for each stage the
  // feature hook fires, then the stage runs; a failing stage routes
  // through makeError (which throws, or returns fallback data when
  // ctrl.throw is false).
  protected Object runOp(Context ctx, Runnable postDone) {
    Utility utility = this.utility;

    try {
// #PrePoint-Hook

      Object point = utility.makePoint.apply(ctx);
      ctx.out.put("point", point);

// #PreSpec-Hook

      Object spec = utility.makeSpec.apply(ctx);
      ctx.out.put("spec", spec);

// #PreRequest-Hook

      Object request = utility.makeRequest.apply(ctx);
      ctx.out.put("request", request);

// #PreResponse-Hook

      Object response = utility.makeResponse.apply(ctx);
      ctx.out.put("response", response);

// #PreResult-Hook

      Object result = utility.makeResult.apply(ctx);
      ctx.out.put("result", result);

// #PreDone-Hook

      postDone.run();

      return utility.done.apply(ctx);
    }
    catch (RuntimeException err) {
      // An error already finalised by makeError (e.g. via done) must not
      // be wrapped a second time.
      if (err == ctx.ctrl.err) {
        throw err;
      }
      return utility.makeError.apply(ctx, err);
    }
  }
}
