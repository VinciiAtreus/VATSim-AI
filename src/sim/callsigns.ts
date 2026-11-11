export const TELEPHONY = {
  MAS: 'Malaysian',
  MXD: 'Malindo',
  AXM: 'Redcap',
  SIA: 'Singapore',
} as const
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
export function spokenCallsign(callsign: string): string | null {
  const match = callsign.toUpperCase().match(/^(MAS|MXD|AXM|SIA)(\d{1,4})$/)
  return match
    ? `${TELEPHONY[match[1] as keyof typeof TELEPHONY]} ${[...match[2]].map((d) => words[Number(d)]).join(' ')}`
    : null
}

// Retain an author's number pronunciation; only correct known airline telephony.
export function applyTelephony(callsign: string, spoken: string): string {
  const name = TELEPHONY[callsign.slice(0, 3) as keyof typeof TELEPHONY]
  return name
    ? spoken.replace(
        /^(?:Malaysian|Malindo|Redcap|Singapore|Air\s?Asia|Batik(?: Air)?)(?=\s)/i,
        name,
      )
    : spoken
}
