# notes java/kotlin
java: Main.fragment accessor new each call (MainEntity_java.ts:31-33); SdkClient optionsMap clone 99-105, getUtility copy 107; direct->rawRequest 201-383
java entity: EntityBase.fragment data() clone 85-95, match clone 98-107, deleted() method 47, stream signal BooleanSupplier 214-216, runOp eager 246
remove fragment: data replaced by resdata if non-null (RemoveOp 36-39)
java Q10: testSDK -> testOptions puts feature.test.active; optspec feature CHILD open (optspec.ts:56-61) so accepted; makeFeature default BaseFeature (Config_java.ts:207-208); mode test -> Fetcher.fetcher fetch_mode_block (Fetcher.java:272-275)
java explain: Context.java 69-71 only Map
java direct: SdkClient 288-383; unreadable -> err + status (370-376) ; old README 111 claims only one present (false)
java deleted(): EntityBase only, not on SdkEntity interface
java Q12: package voxgig.demosdk.core, pom sourceDirectory basedir; no main; old root README quickstart: top-level statements, no class
kotlin: same structure. SdkClient.kt direct 187-356; optionsMap 89-95; getUtility 97-99; EntityBase.fragment.kt name property 48, data 79-88, match 90-99, deleted() 113, stream signal Function0 263-270, runOp at call 243, sequence lazy 275
kotlin Q10: Config_kotlin.ts:170 else BaseFeature; Fetcher.kt 235-238
kotlin server var -> SdkError server_var_required (MakeOptions.kt:177); java IllegalArgumentException; B root quickstart kotlin omits server map (README 517-531) while java passes it
DONE reading; writing result
