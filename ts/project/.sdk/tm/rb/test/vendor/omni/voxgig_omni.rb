# VENDORED: @voxgig/omni sdk-20260904-1610-0 (ruby/lib/voxgig_omni.rb)
# Source: https://github.com/voxgig/omni @ 8c3e1b573a8d35796f7fc45e3226b977023cabf7  [tag: sdk-20260904-1610-0]
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
