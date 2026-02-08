export function isFileLockedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybeErr = err as NodeJS.ErrnoException;
  return (
    maybeErr.code === "EPERM" ||
    maybeErr.code === "EACCES" ||
    maybeErr.code === "EBUSY"
  );
}
