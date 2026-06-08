export class NotFoundError extends Error {
  statusCode = 404

  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends Error {
  statusCode = 400

  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
