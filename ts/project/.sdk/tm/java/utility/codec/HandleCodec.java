package JAVAPACKAGE.utility.codec;

import java.util.LinkedHashMap;
import java.util.Map;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.SdkEntity;
import JAVAPACKAGE.core.SdkError;

/** An entity's named bytes, reached through its binary(slot). */
public final class HandleCodec {

  private static final String RAW_BODY = "$body";

  private HandleCodec() {}

  /**
   * A slot the entity component derived from the model: the action whose
   * points move its bytes ("" for the entity's own), and the operations that
   * read and write them (null where the slot has none).
   */
  public record SlotDef(String action, String read, String write) {}

  /**
   * Each call is one run of the entity's own operation on the slot's point;
   * in core only whole, in-memory bodies move.
   */
  public static final class BinaryHandle {

    private final SdkEntity entity;
    private final Context entctx;
    private final String slot;
    private final SlotDef def;

    public BinaryHandle(SdkEntity entity, Context entctx, Map<String, SlotDef> slots,
        String slot) {
      this.entity = entity;
      this.entctx = entctx;
      this.slot = slot == null ? "" : slot;
      this.def = slots.get(this.slot);
    }

    public String name() {
      return this.slot;
    }

    public byte[] bytes() {
      return bytes(null, null);
    }

    // The whole body, within maxBuffer.
    public byte[] bytes(Map<String, Object> opts, Map<String, Object> ctrl) {
      if (opts != null && opts.get("range") != null) {
        throw inactive("read a range");
      }
      SlotDef found = direction("read");
      Map<String, Object> transfer = new LinkedHashMap<>();
      transfer.put("slot", this.slot);
      transfer.put("direction", "read");
      run(found.read(), select(found), withTransfer(ctrl, transfer));
      Object bytes = transfer.get("bytes");
      return bytes instanceof byte[] ? (byte[]) bytes : new byte[0];
    }

    public SdkEntity put(Object source) {
      return put(source, null);
    }

    // Sends in-memory content as the slot's body; resolves to the entity.
    public SdkEntity put(Object source, Map<String, Object> ctrl) {
      SlotDef found = direction("write");
      Map<String, Object> transfer = new LinkedHashMap<>();
      transfer.put("slot", this.slot);
      transfer.put("direction", "write");
      Map<String, Object> data = select(found);
      data.put(RAW_BODY, source);
      run(found.write(), data, withTransfer(ctrl, transfer));
      return this.entity;
    }

    public void save(Object... args) {
      throw inactive("save");
    }

    public void stream(Object... args) {
      throw inactive("stream");
    }

    public void open(Object... args) {
      throw inactive("open");
    }

    private void run(String op, Map<String, Object> arg, Map<String, Object> ctrl) {
      switch (op) {
        case "load": this.entity.load(arg, ctrl); break;
        case "create": this.entity.create(arg, ctrl); break;
        case "update": this.entity.update(arg, ctrl); break;
        case "patch": this.entity.patch(arg, ctrl); break;
        default: throw error("binary_slot_direction", "The binary slot \"" + this.slot
            + "\" of entity \"" + this.entity.getName() + "\" has no operation " + op + ".");
      }
    }

    private static Map<String, Object> withTransfer(Map<String, Object> ctrl,
        Map<String, Object> transfer) {
      Map<String, Object> out = new LinkedHashMap<>();
      if (ctrl != null) {
        out.putAll(ctrl);
      }
      out.put("transfer", transfer);
      return out;
    }

    private static Map<String, Object> select(SlotDef def) {
      Map<String, Object> out = new LinkedHashMap<>();
      if (!"".equals(def.action())) {
        out.put("$action", def.action());
      }
      return out;
    }

    private SlotDef direction(String way) {
      if (this.def == null) {
        throw error("binary_slot_unknown", "Entity \"" + this.entity.getName()
            + "\" has no binary slot \"" + this.slot + "\".");
      }
      if (("read".equals(way) ? this.def.read() : this.def.write()) == null) {
        throw error("binary_slot_direction", "The binary slot \"" + this.slot
            + "\" of entity \"" + this.entity.getName() + "\" cannot be "
            + ("read".equals(way) ? "read" : "written") + ".");
      }
      return this.def;
    }

    private SdkError inactive(String what) {
      return error("binary_feature_inactive", "The binary slot \"" + this.slot
          + "\" of entity \"" + this.entity.getName() + "\" cannot " + what
          + " without the binary feature; in core it answers bytes() and put().");
    }

    private SdkError error(String code, String msg) {
      return this.entctx == null ? new SdkError(code, msg, null)
          : this.entctx.makeError(code, msg);
    }
  }
}
