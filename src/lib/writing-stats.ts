export function countWords(text: string) {
  const matches = text.trim().match(/\S+/g);
  return matches?.length ?? 0;
}

export function readingTimeMinutes(wordCount: number, wordsPerMinute = 200) {
  if (wordCount <= 0) return 0;
  return Math.max(1, Math.round(wordCount / wordsPerMinute));
}

export function formatWordStats(text: string) {
  const words = countWords(text);
  const minutes = readingTimeMinutes(words);
  return {
    words,
    minutes,
    label: words === 0 ? "0 words" : `${words.toLocaleString()} words · ${minutes} min read`,
  };
}
