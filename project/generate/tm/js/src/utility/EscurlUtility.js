
function escurl(s) {
  s = null == s ? '' : s
  return encodeURIComponent(s)
}

module.exports = {
  escurl
}
