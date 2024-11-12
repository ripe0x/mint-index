// utils/errors.ts

import { useState, useCallback } from "react";

export class ContractError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "ContractError";
  }
}

export class MetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetadataError";
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ContractError) {
    return `Contract Error: ${error.message}`;
  }

  if (error instanceof MetadataError) {
    return `Metadata Error: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    if ("message" in error) {
      return String(error.message);
    }
    if ("error" in error && typeof error.error === "string") {
      return error.error;
    }
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unknown error occurred";
}

// Type guard for error objects
export function isErrorWithMessage(
  error: unknown
): error is { message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  );
}

// Custom hook for error handling
export function useErrorHandler() {
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((err: unknown) => {
    setError(getErrorMessage(err));
  }, []);

  return {
    error,
    setError,
    handleError,
    clearError: () => setError(null),
  };
}
