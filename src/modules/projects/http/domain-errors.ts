// Core stays free of HTTP (some of it runs in the browser), so its errors become
// HTTP answers here, once, for every route.
import { HttpException, ProblemException } from '@forinda/kickjs'
import { ProjectError } from '@/core/project/project'
import { PathError, StaleWriteError } from '@/core/storage/workspace'

function toHttpException(err: unknown): unknown {
  if (err instanceof PathError) return HttpException.badRequest(err.message)
  if (err instanceof ProjectError) {
    return new ProblemException({ status: 400, detail: err.message, issues: err.issues })
  }
  if (err instanceof StaleWriteError) {
    return new ProblemException({ status: 409, detail: err.message, current: err.current })
  }
  return err
}

type ErrorHandler<Req, Res> = (
  err: unknown,
  req: Req,
  res: Res,
  next: (err?: unknown) => void,
) => unknown

/** Wrap the app's error handler, so it sees core's errors as HTTP exceptions. */
export const withDomainErrors =
  <Req, Res>(handler: ErrorHandler<Req, Res>): ErrorHandler<Req, Res> =>
  (err, req, res, next) =>
    handler(toHttpException(err), req, res, next)
