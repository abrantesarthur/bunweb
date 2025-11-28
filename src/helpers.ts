import { HttpErrorMessage } from "./types";

/**
 * Returns a HTTP error response for a given error message.
 * @param msg - The error message
 * @returns A HTTP error response
 */
export const getHttpErrorResponse = (msg: HttpErrorMessage): Response =>
  new globalThis.Response(msg, { status: getHttpErrorStatus(msg) });

/**
 * Returns the HTTP status code for a given error message.
 * @param msg - The error message
 * @returns The HTTP status code
 */
export const getHttpErrorStatus = (msg: HttpErrorMessage): number =>
  ({
    [HttpErrorMessage.BadRequest]: 400,
    [HttpErrorMessage.Forbidden]: 403,
    [HttpErrorMessage.NotFound]: 404,
    [HttpErrorMessage.NotAllowed]: 405,
    [HttpErrorMessage.InternalServerError]: 500,
  }[msg]);
