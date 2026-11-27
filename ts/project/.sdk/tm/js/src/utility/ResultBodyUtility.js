
const { headerValue, isBinaryResponse } = require('./MediaUtility')


const PREVIEW_LENGTH = 160


async function resultBody(ctx) {
  const response = ctx.response
  const result = ctx.result

  if (result) {
    const raw = ctx.utility.codec?.raw
    if (null != response && 'raw' === ctx.point?.response?.kind && 'function' === typeof raw &&
      null == result.err && null == response.err && result.status < 400) {
      await raw(ctx)
    }
    else if (response && response.json && null != response.body) {
      try {
        const json = await response.json()
        result.body = json
      }
      catch (err) {
        if ('SyntaxError' !== err?.name) {
          if (true === ctx.ctrl?.signal?.aborted) {
            throw err
          }
          result.err = result.err ?? bodyReadError(ctx, result, err)
          return result
        }
        result.err = unreadableBody(ctx, {
          status: result.status, headers: result.headers, text: err.text,
          sent: ctx.spec?.headers, failed: result.err,
        })
      }
    }
  }

  return result
}


// A body that stopped before its end (a dropped connection, a deadline),
// named by the failure's kind alone: its message can carry a value.
function bodyReadError(ctx, result, err) {
  const kind = [err?.name, err?.code ?? err?.cause?.code]
    .filter((part) => 'string' === typeof part && '' !== part).join(' ')
  const type = headerValue(result.headers, 'content-type')
  const failed = ctx.error('response_body_read', 'response: body could not be read' +
    ('' === kind ? '' : ' (' + kind + ')') + ' (HTTP ' + result.status + ', content-type ' +
    (type || 'none') + ')')
  Object.defineProperty(failed, 'cause', { value: err, writable: true, configurable: true })
  return failed
}


// A body that is not JSON. An HTTP failure keeps its own error, with the
// response described; otherwise the code tells a wrong content type from
// malformed JSON.
function unreadableBody(ctx, res) {
  const type = headerValue(res.headers, 'content-type')
  // Only text is quoted: bytes are a file's, by the model or by their type.
  const quoted = null != res.text && !isBinaryResponse(ctx.point, type)
  const detail = 'HTTP ' + res.status + ', content-type ' + (type || 'none') +
    ', user-agent ' + (ctx.utility.clean(ctx, headerValue(res.sent, 'user-agent')) || 'transport default') +
    (quoted ? ', body: ' + preview(ctx, res.text) : '')

  if (null != res.failed) {
    res.failed.message += ' (' + detail + ')'
    return res.failed
  }

  return '' === type || /json/i.test(type)
    ? ctx.error('response_json_invalid', 'response: body is not valid JSON (' + detail + ')')
    : ctx.error('response_content_type', 'response: expected JSON, got ' + type +
      ' (' + detail + ')')
}


// Cleaned whole: a secret the bound would split could leave its prefix.
function preview(ctx, text) {
  const flat = ctx.utility.clean(ctx, String(text).replace(/\s+/g, ' ').trim())
  return PREVIEW_LENGTH < flat.length ? flat.slice(0, PREVIEW_LENGTH) + '...' : flat
}


module.exports = {
  resultBody,
  unreadableBody,
}
