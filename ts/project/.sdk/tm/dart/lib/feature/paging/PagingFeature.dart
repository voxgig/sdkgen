// ignore_for_file: non_constant_identifier_names

import '../base/BaseFeature.dart';

// Pagination support for list operations. On the way out (PreRequest) it
// stamps page/limit (or a cursor) into the request query; on the way back
// (PreResult) it reads the server's pagination signals — a `Link:
// rel="next"` header, `X-Next-Page`/`X-Total-Count` headers, or `next`/
// `cursor`/`hasMore` fields in the body — and records them on
// `ctx.result.paging`. Generated SDKs build auto-iteration on top of this
// (advance the cursor/page and re-issue the list call until `hasMore` is
// false). Parameter names and page size are configurable.
class PagingFeature extends BaseFeature {
  dynamic _client;

  PagingFeature() {
    version = '0.0.1';
    name = 'paging';
    active = true;
  }

  @override
  dynamic init(dynamic ctx, dynamic opts) {
    _client = ctx.client;
    options = opts is Map ? Map<String, dynamic>.from(opts) : {};
    active = true == options['active'];
    return null;
  }

  @override
  dynamic PreRequest(dynamic ctx) {
    if (!_isList(ctx)) {
      return null;
    }
    final spec = ctx.spec;
    if (null == spec) {
      return null;
    }
    spec.query ??= {};

    final pageParam = options['pageParam'] ?? 'page';
    final limitParam = options['limitParam'] ?? 'limit';
    final cursorParam = options['cursorParam'] ?? 'cursor';

    // A per-call cursor/page from ctrl takes priority (used by auto-iteration).
    final paging = (ctx.ctrl is Map ? ctx.ctrl['paging'] : null) ?? {};

    if (null != paging['cursor']) {
      spec.query[cursorParam] = paging['cursor'];
    } else if (null == spec.query[pageParam]) {
      spec.query[pageParam] =
          null != paging['page'] ? paging['page'] : (options['startPage'] ?? 1);
    }

    if (null != options['limit'] && null == spec.query[limitParam]) {
      spec.query[limitParam] = options['limit'];
    }
    return null;
  }

  @override
  dynamic PreResult(dynamic ctx) {
    if (!_isList(ctx)) {
      return null;
    }
    final result = ctx.result;
    if (null == result) {
      return null;
    }

    final headers = result.headers ?? {};
    final body = result.body;

    final paging = <String, dynamic>{
      'page': _num(_header(headers, 'x-page')),
      'totalCount': _num(_header(headers, 'x-total-count')),
      'nextPage': _num(_header(headers, 'x-next-page')),
      'next': null,
      'cursor': null,
      'hasMore': false,
    };

    // Link: <...>; rel="next"
    final link = _header(headers, 'link');
    if (null != link) {
      final m = RegExp(r'<([^>]+)>\s*;\s*rel="?next"?', caseSensitive: false)
          .firstMatch(link.toString());
      if (null != m) {
        paging['next'] = m.group(1);
      }
    }

    // Body-level cursors.
    if (body is Map) {
      if (null != body['next']) {
        paging['next'] = paging['next'] ?? body['next'];
      }
      if (null != body['cursor']) {
        paging['cursor'] = body['cursor'];
      }
      if (null != body['nextCursor']) {
        paging['cursor'] = body['nextCursor'];
      }
      if (body['hasMore'] is bool) {
        paging['hasMore'] = body['hasMore'];
      }
    }

    paging['hasMore'] = true == paging['hasMore'] ||
        null != paging['next'] ||
        null != paging['cursor'] ||
        null != paging['nextPage'];

    result.paging = paging;

    final track = _client.track;
    track['paging'] = <String, dynamic>{'last': paging};
    return null;
  }

  bool _isList(dynamic ctx) {
    final ops = options['ops'] ?? ['list'];
    return (ops as List).contains(null == ctx.op ? null : ctx.op.name);
  }

  dynamic _header(dynamic headers, String name) {
    final lower = name.toLowerCase();
    if (headers is! Map) {
      return null;
    }
    for (final k in headers.keys) {
      if (k.toString().toLowerCase() == lower) {
        return headers[k];
      }
    }
    return null;
  }

  num? _num(dynamic v) {
    if (null == v) {
      return null;
    }
    return v is num ? v : num.tryParse(v.toString());
  }
}
