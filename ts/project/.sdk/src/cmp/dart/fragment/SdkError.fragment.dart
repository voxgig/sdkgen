class ProjectNameError extends Error {
  final bool isProjectNameError = true;

  final String sdk = 'ProjectName';

  String code;
  String message;
  dynamic ctx;

  // Populated by makeError with the (cleaned) result and spec.
  dynamic result;
  dynamic spec;

  ProjectNameError(this.code, this.message, [this.ctx]);

  @override
  String toString() => 'ProjectNameError: ' + code + ': ' + message;
}
