# VENDORED: @voxgig/omni sdk-20261009-0906-0 (ruby/lib/voxgig_omni.rb)
# Source: https://github.com/voxgig/omni @ 5ab24080fb06b45bbbbc3814522bda7da30b520b  [tag: sdk-20261009-0906-0]
# License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
# voxgig_omni - shared multi-language test runner.

require_relative 'util'
require_relative 'runner'

module VoxgigOmni
  module_function

  def make_runner(specref, provider = nil)
    Runner.make_runner(specref, provider)
  end
end
