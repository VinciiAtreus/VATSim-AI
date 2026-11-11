import { describe, it, expect } from 'vitest'
import { createSimulation, createSession, enableContinuous, tick, sessionExport } from './engine'
import { decodeSession, forkSession } from './sessionCodec'
import { preferredVoice, spokenReadback } from './readback'
describe('continuous operations', () => {
  it('replenishes completed traffic with unique callsigns and round-trips current and historical fleets', () => {
    const start = createSimulation(),
      before = JSON.stringify(start)
    const s = tick({ ...start, running: true }, 1800)
    expect(s.simulation!.registry.length).toBeGreaterThan(5)
    expect(s.aircraft.length).toBe(4)
    expect(
      s.aircraft.some((a) => a.id.startsWith('SIA')) ||
        s.simulation!.registry.some((t) => t.callsign.startsWith('SIA')),
    ).toBe(true)
    expect(JSON.stringify(start)).toBe(before)
    const restored = decodeSession(sessionExport(s)).session
    expect(restored).toEqual({ ...s, running: false })
    expect(s.events[0].snapshot.some((a) => a.id === 'MAS1134')).toBe(true)
  })
  it('pauses releases and restarts them without changing active traffic', () => {
    let s = createSimulation()
    s.aircraft[0].phase = 'complete'
    s.simulation!.trafficEnabled = false
    s = tick({ ...s, running: true }, 200)
    expect(s.aircraft[0].id).toBe('MAS612')
    s.simulation!.trafficEnabled = true
    s = tick(s, 1)
    expect(s.aircraft[0].id).not.toBe('MAS612')
    expect(s.aircraft[0].phase).toBe('parked')
  })
  it('preserves legacy records and clones continuous traffic timers on forks', () => {
    const legacy = createSession('departure'),
      before = JSON.stringify(legacy)
    const s = enableContinuous(forkSession(legacy))
    expect(s.id).not.toBe(legacy.id)
    expect(JSON.stringify(legacy)).toBe(before)
    expect(decodeSession(sessionExport(s)).session.simulation).toEqual(s.simulation)
    const fork = forkSession(s)
    fork.simulation!.registry[0].callsign = 'MAS999'
    expect(s.simulation!.registry[0].callsign).toBe('MAS612')
  })
  it('rejects corrupt continuous identity registries', () => {
    const value = sessionExport(createSimulation())
    value.session.simulation!.registry[0].callsign = 'bad'
    expect(() => decodeSession(value)).toThrow(/registry/)
  })
})
describe('pilot readback voice', () => {
  it('prefers natural English voices without claiming one is installed', () => {
    const standard = { name: 'English', lang: 'en-US', localService: true } as SpeechSynthesisVoice
    const natural = {
      name: 'Microsoft Sonia Online (Natural)',
      lang: 'en-GB',
      localService: false,
    } as SpeechSynthesisVoice
    expect(preferredVoice([standard, natural])).toBe(natural)
    expect(preferredVoice([])).toBeUndefined()
  })
  it('speaks runway sides, taxiway identifiers and decimal radio frequencies explicitly', () => {
    const result = spokenReadback('Taxi via T2 F1 G, hold short runway 32R. Contact 118.800.')
    expect(result).toContain('Tango two Foxtrot one Golf')
    expect(result).toContain('three two right')
    expect(result).toContain('one one eight decimal eight zero zero')
  })
  it('pronounces Quebec stand identifiers without converting ordinary pronouns/articles', () => {
    expect(spokenReadback('A delay, I am at stand Q4, taxi via U5 Z Z8 Y Y9.')).toBe(
      'A delay, I am at stand Quebec four, taxi via Uniform five Zulu Zulu eight Yankee Yankee nine.',
    )
  })
})
