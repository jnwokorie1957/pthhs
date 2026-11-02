// Only construct before any vendor request has been dispatched.
export class HhaNotSubmittedError extends Error {
  constructor(cause?: unknown) { super("hha_not_submitted", { cause }); this.name = "HhaNotSubmittedError"; }
}
