// ProjectName SDK exists test.

import XCTest

@testable import ProjectNameSdk

final class ExistsTest: XCTestCase {
  func testMode() {
    let testsdk = ProjectNameSDK.testSDK(nil, nil)
    XCTAssertEqual(testsdk.mode, "test")
  }
}
