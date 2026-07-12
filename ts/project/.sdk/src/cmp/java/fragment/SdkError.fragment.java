package JAVAPACKAGE.core;

/**
 * ProjectName SDK error. Carries the SDK error code, the operation
 * context, and cleaned copies of the result and spec at failure time.
 */
public class SdkError extends RuntimeException {

  public final String sdk = "ProjectName";
  public String code;
  public String msg;
  public transient Context ctx;
  public transient Object result;
  public transient Object spec;

  public SdkError(String code, String msg, Context ctx) {
    super(msg);
    this.code = code == null ? "" : code;
    this.msg = msg;
    this.ctx = ctx;
  }

  @Override
  public String getMessage() {
    return this.msg;
  }
}
