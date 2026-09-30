// Only construct before any vendor request has been dispatched.
export class HhaNotSubmittedError extends Error {
  constructor() { super("hha_not_submitted"); this.name = "HhaNotSubmittedError"; }
}
