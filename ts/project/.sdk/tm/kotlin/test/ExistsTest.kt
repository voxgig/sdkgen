package KOTLINPACKAGE.sdktest

import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test

import KOTLINPACKAGE.core.ProjectNameSDK

class ExistsTest {

  @Test
  fun testMode() {
    val testsdk = ProjectNameSDK.testSDK()
    assertNotNull(testsdk, "expected non-nil SDK")
  }
}
