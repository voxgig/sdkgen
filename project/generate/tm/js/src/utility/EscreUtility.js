
/* Escape regular expression characters.
 *
 * Prevents unwanted matches.
 */
function escre(s) {
  s = null == s ? '' : s
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = {
  escre
}
