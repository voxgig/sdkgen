// EJECT-START

  Value list(const Value& reqmatch, const Value& ctrl) override {
    CtxSpec cs;
    cs.setOpname("list");
    cs.ctrlMap = ctrl.is_map() ? ctrl : vmap();
    cs.match = this->match_;
    cs.data = this->data_;
    cs.reqmatch = reqmatch.is_map() ? reqmatch : vmap();
    CtxPtr ctx = this->utility->makeContext(cs, this->entctx);

    return runOp(ctx, [this, ctx]() {
      if (ctx->result) {
        if (ctx->result->resmatch.is_map()) {
          this->match_ = ctx->result->resmatch;
        }
      }
    });
  }

// EJECT-END
