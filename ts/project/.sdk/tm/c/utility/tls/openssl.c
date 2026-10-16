// The TLS backend that binds the platform's OpenSSL (TLS=openssl), and the
// only file in this SDK that names it. Cryptographic transport is not
// written here; what this file decides is what a handshake trusts, and it
// meets four obligations, each marked where it is met: (1) the chain is
// verified against the system trust store; (2) the host name is verified,
// an IP literal as an address; (3) SNI is sent, but never for an IP
// literal; (4) PROJECTENV_CA_BUNDLE adds roots and replaces none. A pin
// stands in for (1) and (4) and leaves (2) in force.

#include "tls.h"

#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <openssl/err.h>
#include <openssl/evp.h>
#include <openssl/ssl.h>
#include <openssl/x509.h>
#include <openssl/x509v3.h>

#if OPENSSL_VERSION_NUMBER < 0x10100000L
#error "the TLS backend needs OpenSSL 1.1.0 or later"
#endif

struct HttpTls {
  SSL_CTX* ctx;
  SSL* ssl;
  BIO_METHOD* method;
  HttpTlsIo io;
  const char* why; // the transport's reason, when its own read or write failed
  unsigned char pin[32];
  int mismatch;
  STACK_OF(X509)* anchors;
  char msg[256];
};

int http_tls_available(void) { return 1; }

// Every byte goes through the transport's own send and recv, so its deadline
// and its SIGPIPE handling hold inside TLS as well.
static int bio_write(BIO* b, const char* data, int len) {
  HttpTls* t = (HttpTls*)BIO_get_data(b);
  BIO_clear_retry_flags(b);
  long n = t->io.send(t->io.io, data, (size_t)len, &t->why);
  return n < 0 ? -1 : (int)n;
}

static int bio_read(BIO* b, char* data, int len) {
  HttpTls* t = (HttpTls*)BIO_get_data(b);
  BIO_clear_retry_flags(b);
  long n = t->io.recv(t->io.io, data, (size_t)len, &t->why);
  return n < 0 ? -1 : (int)n;
}

static long bio_ctrl(BIO* b, int cmd, long num, void* ptr) {
  (void)b; (void)num; (void)ptr;
  return BIO_CTRL_FLUSH == cmd ? 1 : 0;
}

static int bio_create(BIO* b) {
  BIO_set_init(b, 1);
  return 1;
}

// Why the handshake or a record failed, in the most specific words known.
static const char* describe(HttpTls* t, const char* fallback) {
  long verify = NULL == t->ssl ? X509_V_OK : SSL_get_verify_result(t->ssl);
  unsigned long code = ERR_peek_last_error();
  if (t->mismatch) {
    snprintf(t->msg, sizeof(t->msg), "the server's certificate is not the one "
      "PROJECTENV_TLS_PIN names");
  } else if (X509_V_OK != verify) {
    snprintf(t->msg, sizeof(t->msg), "certificate verify failed: %s",
      X509_verify_cert_error_string(verify));
  } else if (NULL != t->why) {
    snprintf(t->msg, sizeof(t->msg), "%s", t->why);
  } else if (0 != code) {
    ERR_error_string_n(code, t->msg, sizeof(t->msg));
  } else {
    snprintf(t->msg, sizeof(t->msg), "%s", fallback);
  }
  ERR_clear_error();
  return t->msg;
}

// With a pin, the certificate presented must be the pinned one, and it is
// then the chain's only anchor: the name and the validity period are still
// checked against it, as for any chain.
static int verify_pinned(X509_STORE_CTX* store, void* arg) {
  HttpTls* t = (HttpTls*)arg;
  X509* leaf = X509_STORE_CTX_get0_cert(store);
  unsigned char md[EVP_MAX_MD_SIZE];
  unsigned int n = 0;
  if (NULL == leaf || 1 != X509_digest(leaf, EVP_sha256(), md, &n) || 32 != n ||
      0 != memcmp(md, t->pin, 32)) {
    t->mismatch = 1;
    X509_STORE_CTX_set_error(store, X509_V_ERR_CERT_REJECTED);
    return 0;
  }
  t->anchors = sk_X509_new_null();
  sk_X509_push(t->anchors, leaf);
  X509_STORE_CTX_set0_trusted_stack(store, t->anchors);
  X509_VERIFY_PARAM_set_flags(X509_STORE_CTX_get0_param(store), X509_V_FLAG_PARTIAL_CHAIN);
  return X509_verify_cert(store);
}

static X509* peer_certificate(SSL* ssl) {
#if OPENSSL_VERSION_NUMBER >= 0x30000000L && !defined(LIBRESSL_VERSION_NUMBER)
  return SSL_get1_peer_certificate(ssl);
#else
  return SSL_get_peer_certificate(ssl);
#endif
}

void http_tls_close(HttpTls* t) {
  if (NULL == t) return;
  if (NULL != t->ssl) {
    if (SSL_is_init_finished(t->ssl)) SSL_shutdown(t->ssl);
    SSL_free(t->ssl);
  }
  if (NULL != t->ctx) SSL_CTX_free(t->ctx);
  if (NULL != t->method) BIO_meth_free(t->method);
  if (NULL != t->anchors) sk_X509_free(t->anchors);
  ERR_clear_error();
  free(t);
}

static char* refuse(HttpTls* t, const char* fallback) {
  const char* why = describe(t, fallback);
  char* out = (char*)malloc(strlen(why) + 1);
  strcpy(out, why);
  http_tls_close(t);
  return out;
}

char* http_tls_open(HttpTlsIo io, const char* host, const unsigned char* pin,
                    const char* bundle, HttpTls** out) {
  *out = NULL;
  ERR_clear_error();
  HttpTls* t = (HttpTls*)calloc(1, sizeof(HttpTls));
  t->io = io;

  t->ctx = SSL_CTX_new(TLS_client_method());
  if (NULL == t->ctx) return refuse(t, "TLS setup failed");
  SSL_CTX_set_min_proto_version(t->ctx, TLS1_2_VERSION);
  // A failed verification ends the handshake; without this OpenSSL completes
  // it and leaves the verdict for the caller to ask about.
  SSL_CTX_set_verify(t->ctx, SSL_VERIFY_PEER, NULL);

  if (NULL != pin) {
    memcpy(t->pin, pin, sizeof(t->pin));
    SSL_CTX_set_cert_verify_callback(t->ctx, verify_pinned, t);
  } else {
    // (1) the system trust store, which honours SSL_CERT_FILE and SSL_CERT_DIR.
    if (1 != SSL_CTX_set_default_verify_paths(t->ctx)) {
      return refuse(t, "the system trust store cannot be loaded");
    }
    // (4) extra roots beside the system's.
    if (NULL != bundle && 1 != SSL_CTX_load_verify_locations(t->ctx, bundle, NULL)) {
      ERR_clear_error();
      return refuse(t, "the CA bundle PROJECTENV_CA_BUNDLE names cannot be read");
    }
  }

  t->ssl = SSL_new(t->ctx);
  if (NULL == t->ssl) return refuse(t, "TLS setup failed");
  X509_VERIFY_PARAM* param = SSL_get0_param(t->ssl);
  X509_VERIFY_PARAM_set_hostflags(param, X509_CHECK_FLAG_NO_PARTIAL_WILDCARDS);

  // (2) the name. An IP literal is matched against the certificate's address
  // names: as a DNS name it would match none of them.
  if (1 != X509_VERIFY_PARAM_set1_ip_asc(param, host)) {
    if (1 != SSL_set1_host(t->ssl, host)) return refuse(t, "the host name cannot be verified");
    // (3) SNI, for a name only: a literal address is not a server name.
    SSL_set_tlsext_host_name(t->ssl, host);
  }

  t->method = BIO_meth_new(BIO_get_new_index() | BIO_TYPE_SOURCE_SINK, "sdk transport");
  if (NULL == t->method) return refuse(t, "TLS setup failed");
  BIO_meth_set_write(t->method, bio_write);
  BIO_meth_set_read(t->method, bio_read);
  BIO_meth_set_ctrl(t->method, bio_ctrl);
  BIO_meth_set_create(t->method, bio_create);
  BIO* bio = BIO_new(t->method);
  if (NULL == bio) return refuse(t, "TLS setup failed");
  BIO_set_data(bio, t);
  SSL_set_bio(t->ssl, bio, bio);

  t->why = NULL;
  if (1 != SSL_connect(t->ssl)) return refuse(t, "the TLS handshake failed");

  // The handshake has already verified; these hold even if its mode is ever
  // weakened, and a server that presented no certificate is refused here.
  if (X509_V_OK != SSL_get_verify_result(t->ssl)) return refuse(t, "certificate verify failed");
  X509* peer = peer_certificate(t->ssl);
  if (NULL == peer) return refuse(t, "the server presented no certificate");
  if (NULL != pin) {
    unsigned char md[EVP_MAX_MD_SIZE];
    unsigned int n = 0;
    t->mismatch = 1 != X509_digest(peer, EVP_sha256(), md, &n) || 32 != n ||
      0 != memcmp(md, t->pin, 32);
  }
  X509_free(peer);
  if (t->mismatch) return refuse(t, "certificate verify failed");

  *out = t;
  return NULL;
}

long http_tls_write(HttpTls* t, const char* data, size_t len, const char** why) {
  t->why = NULL;
  ERR_clear_error();
  int n = SSL_write(t->ssl, data, INT_MAX < len ? INT_MAX : (int)len);
  if (0 < n) return n;
  *why = describe(t, "the TLS write failed");
  return -1;
}

long http_tls_read(HttpTls* t, char* data, size_t len, const char** why) {
  t->why = NULL;
  ERR_clear_error();
  int n = SSL_read(t->ssl, data, INT_MAX < len ? INT_MAX : (int)len);
  if (0 < n) return n;
  int e = SSL_get_error(t->ssl, n);
  // A close without close_notify ends a `Connection: close` response as
  // often as one with it; the HTTP framing decides whether it was whole.
  if (SSL_ERROR_ZERO_RETURN == e || (SSL_ERROR_SYSCALL == e && NULL == t->why)) {
    ERR_clear_error();
    return 0;
  }
#if defined(SSL_R_UNEXPECTED_EOF_WHILE_READING)
  if (SSL_ERROR_SSL == e &&
      SSL_R_UNEXPECTED_EOF_WHILE_READING == ERR_GET_REASON(ERR_peek_error())) {
    ERR_clear_error();
    return 0;
  }
#endif
  *why = describe(t, "the TLS read failed");
  return -1;
}
