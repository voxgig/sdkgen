
function joinurl(...s) {
  return s
    .filter(s=>null!=s&&''!==s)
    .map((s,i)=> 0===i ? s.replace(/([^\/])\/+/,'$1/').replace(/\/+$/,'') :
        s.replace(/([^\/])\/+/,'$1/').replace(/^\/+/,'').replace(/\/+$/,''))
    .filter(s=>''!==s)
    .join('/')
}

module.exports = {
  joinurl
}
