# VENDORED: @voxgig/omni sdk-20261127-1940-0 (ruby/lib/voxgig_omni.rb)
# Source: https://github.com/voxgig/omni @ ef55ad0fa48470146a81a1d652c859b03ebab6fc  [tag: sdk-20261127-1940-0]
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
