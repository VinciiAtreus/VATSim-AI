export function preferredVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return voices
    .filter((v) => /^en\b/i.test(v.lang))
    .sort((a, b) => {
      const score = (v: SpeechSynthesisVoice) =>
        (/natural|neural|online|premium/i.test(v.name) ? 100 : 0) +
        (/^en-(GB|SG)/i.test(v.lang) ? 20 : 0) +
        (v.localService ? 0 : 5)
      return score(b) - score(a)
    })[0]
}
export function spokenReadback(text: string): string {
  const digits = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
  const number = (s: string) => [...s].map((d) => digits[Number(d)]).join(' ')
  const letters: Record<string, string> = {
    A: 'Alpha',
    B: 'Bravo',
    C: 'Charlie',
    D: 'Delta',
    F: 'Foxtrot',
    G: 'Golf',
    T: 'Tango',
    U: 'Uniform',
    Y: 'Yankee',
    Z: 'Zulu',
  }
  return text
    .replace(
      /\b(\d{3})\.(\d{1,3})\b/g,
      (_, a, b) => `${number(a)} decimal ${number(b.padEnd(3, '0'))}`,
    )
    .replace(/\b(32)([RL])\b/g, (_, n, l) => `${number(n)} ${l === 'R' ? 'right' : 'left'}`)
    .replace(/\b33\b/g, 'three three')
    .replace(/\b([A-Z])(\d{1,2})\b/g, (_, l, n) => `${letters[l] ?? l} ${number(n)}`)
    .replace(/\b([ABCDFGTUYZ])\b/g, (l) => letters[l] ?? l)
}
