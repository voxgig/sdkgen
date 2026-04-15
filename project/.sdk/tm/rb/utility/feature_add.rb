# ProjectName SDK utility: feature_add
module ProjectNameUtilities
  FeatureAdd = ->(ctx, f) {
    ctx.client.features << f
  }
end
