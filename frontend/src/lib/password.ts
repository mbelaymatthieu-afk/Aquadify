// Client-side password strength rules: min 8 chars, one upper, one lower, one digit.
export type PasswordChecks = {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
};

export function checkPassword(pw: string): PasswordChecks {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /\d/.test(pw),
  };
}

export function isStrongPassword(pw: string): boolean {
  const c = checkPassword(pw);
  return c.length && c.upper && c.lower && c.digit;
}
