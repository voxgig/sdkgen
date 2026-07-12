package JAVAPACKAGE.core;

import java.util.Map;

/**
 * The full CRUD entity contract of the ProjectName SDK. Every generated
 * entity implements every operation; unsupported operations throw an
 * SdkError at runtime (see Helpers.unsupportedOp).
 */
public interface SdkEntity extends Entity {

  Object load(Map<String, Object> reqmatch, Map<String, Object> ctrl);

  Object list(Map<String, Object> reqmatch, Map<String, Object> ctrl);

  Object create(Map<String, Object> reqdata, Map<String, Object> ctrl);

  Object update(Map<String, Object> reqdata, Map<String, Object> ctrl);

  Object remove(Map<String, Object> reqmatch, Map<String, Object> ctrl);
}
