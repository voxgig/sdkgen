// The TLS seam of the default transport (utility/http.c). The Makefile
// compiles exactly one backend: openssl.c, which binds the platform's
// OpenSSL, or none.c, for a build without it. A new TLS library is a new
// file here that defines these five functions.

#ifndef PROJECTNAME_TLS_H
#define PROJECTNAME_TLS_H

#include <stddef.h>

typedef struct HttpTls HttpTls;

// The transport's own reads and writes, which the backend drives the
// handshake and every record through. Each answers a byte count, 0 at the
// end of the stream, or -1 with *why set.
typedef struct {
  void* io;
  long (*send)(void* io, const char* data, size_t len, const char** why);
  long (*recv)(void* io, char* data, size_t len, const char** why);
} HttpTlsIo;

// Zero when no TLS is compiled in, and every https:// request is refused.
int http_tls_available(void);

// TLS with `host` (no IPv6 brackets), verified before this returns. A
// non-NULL `pin` is the SHA-256 of the one certificate trusted, in place of
// any store; a non-NULL `bundle` is a PEM file of roots added to the
// system's. Answers NULL, or a malloc'd reason it refused.
char* http_tls_open(HttpTlsIo io, const char* host, const unsigned char* pin,
                    const char* bundle, HttpTls** out);

long http_tls_write(HttpTls* tls, const char* data, size_t len, const char** why);
long http_tls_read(HttpTls* tls, char* data, size_t len, const char** why);
void http_tls_close(HttpTls* tls);

#endif // PROJECTNAME_TLS_H
