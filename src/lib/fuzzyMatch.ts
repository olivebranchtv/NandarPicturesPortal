function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fuzzyMatch(str1: string, str2: string, threshold: number = 0.7): boolean {
  const normalized1 = normalizeString(str1);
  const normalized2 = normalizeString(str2);

  if (normalized1 === normalized2) return true;

  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }

  const maxLength = Math.max(normalized1.length, normalized2.length);
  if (maxLength === 0) return true;

  const distance = levenshteinDistance(normalized1, normalized2);
  const similarity = 1 - distance / maxLength;

  return similarity >= threshold;
}

export interface MatchResult<T> {
  item: T;
  score: number;
}

export function findBestMatch<T>(
  searchTerm: string,
  items: T[],
  getMatchString: (item: T) => string,
  threshold: number = 0.7
): MatchResult<T> | null {
  const normalizedSearch = normalizeString(searchTerm);
  let bestMatch: MatchResult<T> | null = null;
  let highestScore = 0;

  for (const item of items) {
    const compareString = getMatchString(item);
    const normalized = normalizeString(compareString);

    if (normalized === normalizedSearch) {
      return { item, score: 1.0 };
    }

    if (normalized.includes(normalizedSearch) || normalizedSearch.includes(normalized)) {
      const score = 0.9;
      if (score > highestScore) {
        highestScore = score;
        bestMatch = { item, score };
      }
      continue;
    }

    const maxLength = Math.max(normalized.length, normalizedSearch.length);
    if (maxLength === 0) continue;

    const distance = levenshteinDistance(normalized, normalizedSearch);
    const similarity = 1 - distance / maxLength;

    if (similarity >= threshold && similarity > highestScore) {
      highestScore = similarity;
      bestMatch = { item, score: similarity };
    }
  }

  return bestMatch;
}
