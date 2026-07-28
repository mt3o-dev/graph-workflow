// Tiny pure-fn Levenshtein distance + fuzzy match helper for the `type_answer`
// card type. No dependency — see spec: "implement a tiny pure-fn Levenshtein".

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  let prevRow = new Array(bl + 1);
  let currRow = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prevRow[j] = j;

  for (let i = 1; i <= al; i++) {
    currRow[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1, // deletion
        currRow[j - 1] + 1, // insertion
        prevRow[j - 1] + cost, // substitution
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[bl];
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Case-insensitive, trim-normalized match with Levenshtein tolerance:
 * exact match after normalization always passes; for longer answers a small
 * edit-distance budget (proportional to length) is tolerated so minor typos
 * still count as correct.
 */
export function isFuzzyMatch(userAnswer: string, accepted: string): boolean {
  const a = normalize(userAnswer);
  const b = normalize(accepted);
  if (a === b) return true;
  if (a.length === 0 || b.length === 0) return false;

  const distance = levenshtein(a, b);
  const tolerance = Math.max(1, Math.floor(Math.min(a.length, b.length) / 8));
  return distance <= tolerance;
}

/** True if `userAnswer` fuzzy-matches any of the accepted answers. */
export function matchesAnyAccepted(userAnswer: string, acceptedAnswers: string[]): boolean {
  return acceptedAnswers.some((accepted) => isFuzzyMatch(userAnswer, accepted));
}
