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
    E: 'Echo',
    F: 'Foxtrot',
    G: 'Golf',
    H: 'Hotel',
    I: 'India',
    J: 'Juliett',
    K: 'Kilo',
    L: 'Lima',
    M: 'Mike',
    N: 'November',
    O: 'Oscar',
    P: 'Papa',
    Q: 'Quebec',
    R: 'Romeo',
    S: 'Sierra',
    T: 'Tango',
    U: 'Uniform',
    V: 'Victor',
    W: 'Whiskey',
    X: 'X-ray',
    Y: 'Yankee',
    Z: 'Zulu',
  }
  const identifier = (s: string) =>
    `${letters[s[0]]}${s.length > 1 ? ' ' + number(s.slice(1)) : ''}`
  return text
    .replace(
      /\bvia ((?:[A-Z](?:\d{1,2})?)(?:\s+[A-Z](?:\d{1,2})?)*)\b/g,
      (_, route) => `via ${route.split(/\s+/).map(identifier).join(' ')}`,
    )
    .replace(
      /\b(\d{3})\.(\d{1,3})\b/g,
      (_, a, b) => `${number(a)} decimal ${number(b.padEnd(3, '0'))}`,
    )
    .replace(/\b(32)([RL])\b/g, (_, n, l) => `${number(n)} ${l === 'R' ? 'right' : 'left'}`)
    .replace(/\b33\b/g, 'three three')
    .replace(/\b([A-Z]\d{1,2})\b/g, identifier)
    .replace(/\binformation ([A-Z])\b/g, (_, l) => `information ${letters[l]}`)
}
