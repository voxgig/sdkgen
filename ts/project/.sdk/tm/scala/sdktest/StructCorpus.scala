// Driver for the struct half of the shared JSON corpus (SDKREL/.sdk/test/test.json).
//
// The ENGINE is the vendored @voxgig/omni runner (sdktest/vendor/omni),
// reached through the adapter in sdktest/OmniResolver.scala. What is left
// here is what only this SDK can supply: which corpus group feeds which
// struct utility, in which argument shape, under which null flag.
//
// This file was REWRITTEN IN PLACE by the vendor-tag rollout. It used to
// carry its own JSON reader, fixJson, deep equality, matchval/doMatch,
// resolveArgs, checkResult, handleError and runSet — a second, hand-written
// implementation of omni's contract that could (and did) pass entries the
// reference runner fails. All of that is gone; the object keeps its name
// (`Runner`) so the Makefile's `--main-class Runner` and every comment that
// names it still hold.

import voxgig.struct.{clone as sclone, *}

object Runner {

  // The sentinels, re-exported for corpus drivers that need them by name.
  val NULLMARK: String = OmniResolver.NULLMARK
  val UNDEFMARK: String = OmniResolver.UNDEFMARK
  val EXISTSMARK: String = OmniResolver.EXISTSMARK

  // ---------------- entry helpers ----------------

  def vget(vin: Value, k: String): Value = vin match {
    case VMap(m) => m.get(k).getOrElse(Noval)
    case _       => Noval
  }

  // RAW presence: distinct from `vget(...) != Noval`, because the nullsem
  // groups declare a key whose value IS null and the two must not collapse.
  def vhas(vin: Value, k: String): Boolean = vin match {
    case VMap(m) => m.contains(k)
    case _       => false
  }

  // ---------------- walk subjects ----------------

  val nullModifier: Modify = (v, key, parent, _inj) => {
    if (v == VStr(NULLMARK)) setprop(parent, key, VNull)
    else v match {
      case VStr(s) => setprop(parent, key, VStr(s.replace(NULLMARK, "null")))
      case _       => ()
    }
  }

  def walkCopySubject(vin: Value): Value = {
    var cur: Value = mkList(Seq(Noval))
    val walkcopy: WalkFn = (key, v, _parent, path) => {
      if (isNullish(key)) {
        cur = mkList(Seq(if (ismap(v)) emptyMap() else if (islist(v)) emptyList() else v))
        v
      } else {
        val i = size(path)
        val nv = if (isnode(v)) {
          cur match { case VList(b) => while (b.length <= i) b.append(Noval); case _ => }
          val n = if (ismap(v)) emptyMap() else emptyList()
          cur match { case VList(b) => b(i) = n; case _ => }
          n
        } else v
        setprop(getelem(cur, VNum((i - 1).toDouble)), key, nv)
        v
      }
    }
    walk(vin, before = Some(walkcopy))
    getelem(cur, VNum(0.0))
  }

  def walkDepthSubject(vin: Value): Value = {
    var top: Value = Noval
    var curr: Value = Noval
    val copy: WalkFn = (key, v, _parent, _path) => {
      if (isNullish(key) || isnode(v)) {
        val child = if (islist(v)) emptyList() else emptyMap()
        if (isNullish(key)) { top = child; curr = child }
        else { setprop(curr, key, child); curr = child }
      } else setprop(curr, key, v)
      v
    }
    walk(vget(vin, "src"), before = Some(copy), maxdepth = vget(vin, "maxdepth"))
    top
  }

  // The `walk/log` group is a single {in, out} node, not a `set`, so it never
  // reaches omni; the comparison goes through OmniRun.compare, which applies
  // omni's own fixjson to both sides.
  def walkLog(vin: Value): Value = {
    val log = emptyList()
    val walklog: WalkFn = (key, v, parent, path) => {
      setprop(log, VNum(size(log).toDouble), VStr(
        "k=" + (if (isNullish(key)) stringify(Noval) else stringify(key)) +
        ", v=" + stringify(v) +
        ", p=" + (if (isNullish(parent)) stringify(Noval) else stringify(parent)) +
        ", t=" + pathify(path)))
      v
    }
    walk(vin, after = Some(walklog))
    log
  }

  // ---------------- groups ----------------

  def runAll(run: OmniRun): Unit = {
    // Every group arrives as an OmniGroup, which carries the PARENT node
    // beside the group: that is what lets the runner tell a section this
    // corpus predates (skipped, named) from a group that vanished out of a
    // section it carries (a corpus regression, failed). See OmniResolver
    // decision 7.
    def g(keys: String*): OmniGroup = run.group(keys*)

    // ----- minor -----
    run.runset("minor.isnode", g("minor", "isnode"))(v => VBool(isnode(v)))
    run.runset("minor.ismap", g("minor", "ismap"))(v => VBool(ismap(v)))
    run.runset("minor.islist", g("minor", "islist"))(v => VBool(islist(v)))
    run.runset("minor.iskey", g("minor", "iskey"), false)(v => VBool(iskey(v)))
    run.runset("minor.strkey", g("minor", "strkey"), false)(v => VStr(strkey(v)))
    run.runset("minor.isempty", g("minor", "isempty"), false)(v => VBool(isempty(v)))
    run.runset("minor.isfunc", g("minor", "isfunc"))(v => VBool(isfunc(v)))
    run.runset("minor.clone", g("minor", "clone"), false)(v => sclone(v))
    run.runset("minor.escre", g("minor", "escre"))(escre)
    run.runset("minor.escurl", g("minor", "escurl"))(escurl)
    run.runset("minor.stringify", g("minor", "stringify"), false)(vin =>
      if (vhas(vin, "val")) VStr(stringify(vget(vin, "val"), vget(vin, "max")))
      else VStr(stringify(Noval)))
    run.runset("minor.jsonify", g("minor", "jsonify"), false)(vin =>
      VStr(jsonify(vget(vin, "val"), vget(vin, "flags"))))
    // RAW presence for `alt`, not `isNullish`: an entry may declare
    // `alt: null` and expect that null BACK, which the hand-written engine
    // this file replaced could not tell from "no alt given" (its equality
    // unified undefined with null, so the entry passed either way). The
    // vendored runner keeps the two apart, and so must the subject.
    run.runset("minor.getelem", g("minor", "getelem"), false)(vin =>
      if (vhas(vin, "alt")) getelem(vget(vin, "val"), vget(vin, "key"), vget(vin, "alt"))
      else getelem(vget(vin, "val"), vget(vin, "key")))
    run.runset("minor.delprop", g("minor", "delprop"))(vin =>
      delprop(vget(vin, "parent"), vget(vin, "key")))
    run.runset("minor.size", g("minor", "size"), false)(v => vint(size(v)))
    run.runset("minor.slice", g("minor", "slice"), false)(vin =>
      slice(vget(vin, "val"), vget(vin, "start"), vget(vin, "end")))
    run.runset("minor.pad", g("minor", "pad"), false)(vin =>
      VStr(pad(vget(vin, "val"), vget(vin, "pad"), vget(vin, "char"))))
    run.runset("minor.pathify", g("minor", "pathify"), false)(vin =>
      if (vhas(vin, "path")) VStr(pathify(vget(vin, "path"), vget(vin, "from")))
      else VStr(pathify(Noval, vget(vin, "from"), absent = true)))
    run.runset("minor.items", g("minor", "items"))(items)
    // RAW presence for `alt` - see minor.getelem above.
    run.runset("minor.getprop", g("minor", "getprop"), false)(vin =>
      if (vhas(vin, "alt")) getprop(vget(vin, "val"), vget(vin, "key"), vget(vin, "alt"))
      else getprop(vget(vin, "val"), vget(vin, "key")))
    run.runset("minor.setprop", g("minor", "setprop"))(vin =>
      setprop(vget(vin, "parent"), vget(vin, "key"), vget(vin, "val")))
    run.runset("minor.haskey", g("minor", "haskey"), false)(vin =>
      VBool(haskey(vget(vin, "src"), vget(vin, "key"))))
    run.runset("minor.keysof", g("minor", "keysof"))(v => mkList(keysof(v).map(s => VStr(s))))
    run.runset("minor.join", g("minor", "join"), false)(vin =>
      VStr(join(vget(vin, "val"), vget(vin, "sep"),
        vget(vin, "url") match { case VBool(true) => true; case _ => false })))
    run.runset("minor.typify", g("minor", "typify"), false)(v => vint(typify(v)))
    run.runset("minor.setpath", g("minor", "setpath"), false)(vin =>
      setpath(vget(vin, "store"), vget(vin, "path"), vget(vin, "val")))
    run.runset("minor.filter", g("minor", "filter"))(vin => {
      val check: ((String, Value)) => Boolean = vget(vin, "check") match {
        case VStr("gt3") => { case (_, x) => x match { case VNum(n) => n > 3.0; case _ => false } }
        case VStr("lt3") => { case (_, x) => x match { case VNum(n) => n < 3.0; case _ => false } }
        case _           => _ => false
      }
      filter(vget(vin, "val"), check)
    })
    run.runset("minor.typename", g("minor", "typename"))(v =>
      VStr(typename(v match { case VNum(n) => n.toInt; case _ => 0 })))
    run.runset("minor.flatten", g("minor", "flatten"))(vin =>
      flatten(vget(vin, "val"), vget(vin, "depth") match { case VNum(n) => n.toInt; case _ => 1 }))

    // ----- walk -----
    val loggrp = g("walk", "log")
    val lognode = OmniResolver.tostruct(loggrp.node)
    run.compare("walk.log", loggrp, getprop(vget(lognode, "out"), VStr("after")),
      walkLog(vget(lognode, "in")))
    run.runset("walk.basic", g("walk", "basic"))(vin =>
      walk(vin, after = Some((_k, v, _p, path) => v match {
        case VStr(s) => VStr(s + "~" +
          (path match { case VList(b) => b.toSeq; case _ => Seq.empty }).map(jsString).mkString("."))
        case _ => v
      })))
    run.runset("walk.copy", g("walk", "copy"))(walkCopySubject)
    run.runset("walk.depth", g("walk", "depth"), false)(walkDepthSubject)

    // ----- merge -----
    val mergegrp = g("merge", "basic")
    val mergebasic = OmniResolver.tostruct(mergegrp.node)
    run.compare("merge.basic", mergegrp,
      vget(mergebasic, "out"), merge(sclone(vget(mergebasic, "in"))))
    run.runset("merge.cases", g("merge", "cases"))(v => merge(v))
    run.runset("merge.array", g("merge", "array"))(v => merge(v))
    run.runset("merge.integrity", g("merge", "integrity"))(v => merge(v))
    run.runset("merge.depth", g("merge", "depth"))(vin =>
      merge(vget(vin, "val"), vget(vin, "depth")))

    // ----- getpath -----
    run.runset("getpath.basic", g("getpath", "basic"))(vin =>
      getpath(vget(vin, "store"), vget(vin, "path")))
    run.runset("getpath.relative", g("getpath", "relative"))(vin => {
      val dpath = vget(vin, "dpath") match {
        case VStr(s) => mkList(s.split("\\.", -1).map(x => VStr(x)).toSeq)
        case _       => Noval
      }
      val d = new InjDef; d.dParent = vget(vin, "dparent"); d.dPath = dpath
      getpath(vget(vin, "store"), vget(vin, "path"), IDef(d))
    })
    run.runset("getpath.special", g("getpath", "special"))(vin => {
      val injm = vget(vin, "inj")
      val d = new InjDef
      d.dBase = getprop(injm, VStr("base")); d.dMeta = getprop(injm, VStr("meta"))
      d.dParent = getprop(injm, VStr("dparent")); d.dPath = getprop(injm, VStr("dpath"))
      d.dKey = getprop(injm, VStr("key"))
      getpath(vget(vin, "store"), vget(vin, "path"), if (isNullish(injm)) INone else IDef(d))
    })
    run.runset("getpath.handler", g("getpath", "handler"))(vin => {
      val store = {
        val m = scala.collection.mutable.LinkedHashMap.empty[String, Value]
        m.put("$TOP", vget(vin, "store"))
        m.put("$FOO", VFunc((_, _, _, _) => VStr("foo")))
        VMap(m)
      }
      val d = new InjDef
      d.dHandler = Some((_inj, v, _ref, _store) => v match {
        case VFunc(f) => f(_inj, Noval, "", Noval)
        case _        => v
      })
      getpath(store, vget(vin, "path"), IDef(d))
    })

    // ----- inject -----
    val injectgrp = g("inject", "basic")
    val injectbasic = OmniResolver.tostruct(injectgrp.node)
    run.compare("inject.basic", injectgrp, vget(injectbasic, "out"), {
      val in_ = vget(injectbasic, "in")
      inject(sclone(getprop(in_, VStr("val"))), sclone(getprop(in_, VStr("store"))))
    })
    run.runset("inject.string", g("inject", "string"))(vin => {
      val d = new InjDef; d.dModify = Some(nullModifier); d.dExtra = vget(vin, "current")
      inject(vget(vin, "val"), vget(vin, "store"), IDef(d))
    })
    run.runset("inject.deep", g("inject", "deep"))(vin =>
      inject(vget(vin, "val"), vget(vin, "store")))

    // ----- transform -----
    val transformgrp = g("transform", "basic")
    val transformbasic = OmniResolver.tostruct(transformgrp.node)
    run.compare("transform.basic", transformgrp, vget(transformbasic, "out"), {
      val in_ = vget(transformbasic, "in")
      transform(getprop(in_, VStr("data")), getprop(in_, VStr("spec")))
    })
    Seq("paths", "cmds", "each", "pack", "ref").foreach { gn =>
      run.runset("transform." + gn, g("transform", gn))(vin =>
        transform(vget(vin, "data"), vget(vin, "spec")))
    }
    run.runset("transform.modify", g("transform", "modify"))(vin => {
      val d = new InjDef
      d.dModify = Some((v, key, parent, _inj) => v match {
        case VStr(s) if !isNullish(key) && !isNullish(parent) =>
          setprop(parent, key, VStr("@" + s))
        case _ => ()
      })
      d.dExtra = vget(vin, "store")
      transform(vget(vin, "data"), vget(vin, "spec"), IDef(d))
    })
    run.runset("transform.format", g("transform", "format"), false)(vin =>
      transform(vget(vin, "data"), vget(vin, "spec")))
    run.runset("transform.apply", g("transform", "apply"))(vin =>
      transform(vget(vin, "data"), vget(vin, "spec")))

    // ----- validate -----
    run.runset("validate.basic", g("validate", "basic"), false)(vin =>
      validate(vget(vin, "data"), vget(vin, "spec")))
    Seq("child", "one", "exact").foreach { gn =>
      run.runset("validate." + gn, g("validate", gn))(vin =>
        validate(vget(vin, "data"), vget(vin, "spec")))
    }
    run.runset("validate.invalid", g("validate", "invalid"), false)(vin =>
      validate(vget(vin, "data"), vget(vin, "spec")))
    run.runset("validate.special", g("validate", "special"))(vin => {
      val injm = vget(vin, "inj")
      val d = new InjDef; d.dMeta = getprop(injm, VStr("meta"))
      validate(vget(vin, "data"), vget(vin, "spec"), if (isNullish(injm)) INone else IDef(d))
    })

    // ----- select -----
    Seq("basic", "operators", "edge", "alts").foreach { gn =>
      run.runset("select." + gn, g("select", gn))(vin =>
        select(vget(vin, "obj"), vget(vin, "query")))
    }

    // ----- nullsem -----
    // Does a PRESENT key holding a JSON null read as "no value"? Every lane
    // runs {null: false}: with the flag on, the runner rewrites every null to
    // '__NULL__' and the section asserts nothing about null at all. A corpus
    // that predates the WHOLE section leaves these five groups SKIPPED and
    // named in the banner, never silently passed; a corpus that carries
    // `nullsem` but has lost one of its groups FAILS instead, because that is
    // a regression rather than a version skew (OmniResolver decision 7).
    run.runset("nullsem.getprop", g("nullsem", "getprop"), false)(vin =>
      if (vhas(vin, "alt")) getprop(vget(vin, "val"), vget(vin, "key"), vget(vin, "alt"))
      else getprop(vget(vin, "val"), vget(vin, "key")))
    run.runset("nullsem.getelem", g("nullsem", "getelem"), false)(vin =>
      if (vhas(vin, "alt")) getelem(vget(vin, "val"), vget(vin, "key"), vget(vin, "alt"))
      else getelem(vget(vin, "val"), vget(vin, "key")))
    run.runset("nullsem.getpath", g("nullsem", "getpath"), false)(vin =>
      getpath(vget(vin, "store"), vget(vin, "path")))
    run.runset("nullsem.haskey", g("nullsem", "haskey"), false)(vin =>
      VBool(haskey(vget(vin, "src"), vget(vin, "key"))))
    run.runset("nullsem.keysof", g("nullsem", "keysof"), false)(v =>
      mkList(keysof(v).map(s => VStr(s))))
  }

  def main(args: Array[String]): Unit = {
    val testfile = if (args.length > 0) args(0) else "SDKREL/.sdk/test/test.json"
    val report = new OmniReport("")
    val all = OmniResolver.loadspec(testfile)
    val run = OmniResolver.section(OmniResolver.makeRunner(all), all, "struct", report)
    runAll(run)
    report.requireran("struct")
    System.exit(report.finish())
  }
}
