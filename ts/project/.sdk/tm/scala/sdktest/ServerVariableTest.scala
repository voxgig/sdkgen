// A templated base URL takes each {name} from the `server` option. A missing
// or empty value fails construction; test mode fills in test-<name>.

import java.util.{Map => JMap}

import SCALAPACKAGE.core.{ProjectNameSDK, SdkError}

object SdkServerTestMain {

  // A variable no API declares, so the API's own server defaults cannot fill it.
  private val BASE = "https://api.example.test/bot{zzvar}"

  private def om(kv: (String, Object)*): JMap[String, Object] = SdkTestSupport.om(kv*)

  def main(args: Array[String]): Unit = {
    val rep = new SdkTestReport()

    rep.scope("server.missing") {
      for (server <- List(om(), om("zzvar" -> ""))) {
        val err =
          try { new ProjectNameSDK(om("base" -> BASE, "server" -> server)); null }
          catch { case e: SdkError => e }
        rep.check("server.missing.fails", err != null,
          "construction should fail without a value for zzvar: " + server)
        if (err != null) {
          rep.eq("server.missing.code", "server_var_required", err.code)
          rep.check("server.missing.message",
            err.msg.contains("the server variable 'zzvar' is required") && err.msg.contains(BASE), err.msg)
        }
      }
    }

    rep.scope("server.filled") {
      val client = new ProjectNameSDK(om("base" -> BASE, "server" -> om("zzvar" -> "T1")))
      rep.eq("server.filled", "https://api.example.test/botT1", client.optionsMap().get("base"))
    }

    rep.scope("server.testmode") {
      val client = new ProjectNameSDK(om("base" -> BASE, "test" -> om("active" -> SdkTestSupport.B(true))))
      rep.eq("server.testmode.option", "https://api.example.test/bottest-zzvar",
        client.optionsMap().get("base"))
      val mock = ProjectNameSDK.testSDK(null, om("base" -> BASE))
      rep.eq("server.testmode.feature", "https://api.example.test/bottest-zzvar",
        mock.optionsMap().get("base"))
    }

    rep.finish("SERVER")
  }
}
