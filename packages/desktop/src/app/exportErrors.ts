export type ExportFailureKind =
  | "fileLock"
  | "parseContract"
  | "commandFailure"
  | "backendFailure"
  | "unknown";

export type ExportUiError = {
  kind: ExportFailureKind;
  userMessage: string;
  technicalMessage: string;
};

type ApiErrorLike = {
  code?: string;
  message?: string;
};

function readApiError(err: unknown): ApiErrorLike {
  if (typeof err === "object" && err !== null) {
    const candidate = err as ApiErrorLike;
    return {
      code: typeof candidate.code === "string" ? candidate.code : undefined,
      message:
        typeof candidate.message === "string" ? candidate.message : undefined,
    };
  }
  if (typeof err === "string") return { message: err };
  return {};
}

function isFileLockMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("os error 32") ||
    lower.includes("access is denied") ||
    lower.includes("permission denied") ||
    lower.includes("open/locked")
  );
}

export function mapExportError(err: unknown): ExportUiError {
  const { code, message } = readApiError(err);
  const technicalMessage = message ?? "Unknown export error";

  if (code === "EXPORT_LOCKED" || isFileLockMessage(technicalMessage)) {
    return {
      kind: "fileLock",
      userMessage:
        "Export failed because the destination PDF is in use. Close the file in other apps and retry.",
      technicalMessage,
    };
  }

  if (code === "EXPORT_RESPONSE_INVALID") {
    return {
      kind: "parseContract",
      userMessage:
        "Export command returned an invalid response format. Retry export and check desktop logs if it persists.",
      technicalMessage,
    };
  }

  if (code === "EXPORT_COMMAND_FAILED") {
    return {
      kind: "commandFailure",
      userMessage: "Export command failed to run. Please retry.",
      technicalMessage,
    };
  }

  if (code === "EXPORT_FAILED") {
    return {
      kind: "backendFailure",
      userMessage: "Export failed while generating PDF.",
      technicalMessage,
    };
  }

  return {
    kind: "unknown",
    userMessage: "Something went wrong during export.",
    technicalMessage,
  };
}
