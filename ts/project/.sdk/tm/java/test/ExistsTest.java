package JAVAPACKAGE.sdktest;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;

import JAVAPACKAGE.core.ProjectNameSDK;

public class ExistsTest {

  @Test
  public void testMode() {
    ProjectNameSDK testsdk = ProjectNameSDK.testSDK();
    assertNotNull(testsdk, "expected non-nil SDK");
  }
}
