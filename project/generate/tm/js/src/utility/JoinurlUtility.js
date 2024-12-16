
function joinurl(...s) {
  return s
    .filter(s=>null!=s&&''!==s)
    .map(s=>s.replace(/^\/+/,'').replace(/\/+$/,''))
    .filter(s=>null!=s&&''!==s)
    .join('/')
}

module.exports = {
  joinurl
}
