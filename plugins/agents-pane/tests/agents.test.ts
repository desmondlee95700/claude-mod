import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const SCROLL = { offset: 0, bodyRows: 20 }
const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 100, scroll: SCROLL, view: {} },
} as const
const PANE = {
  component: 'Pane',
  requestId: 'agents',
  props: { title: 'Agents', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: SCROLL, view: {} },
} as const

function engine(on: On, isPlaced = false) {
  let next = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++next}` }))
  on('tool.call', () => ({ result: 'ok' as never }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.open', () => ({ value: isPlaced ? { isPlaced: true } : { isPlaced: false, reason: 'narrow' } }) as never)
  on('ui.panes', () => [] as never)
  on('ui.close', () => undefined as never)
  on('ui.render', ($, e) => h($.ui.resolve(e).Text, null, 'engine band') as never)
  return mock.clock(on, { now: 0 })
}

const spawn = (description: string) => ({
  tool_use_id: description,
  prompt: description,
  description,
  subagentType: 'Explore',
  provider: { plugin: 'engine', tier: 'core' },
  parentModel: 'claude-opus-5-5',
  background: true,
}) as never

const finish = (agentId: string) =>
  ({ agentId, answer: 'done', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' }) as never

test('the strip appears once a subagent starts, counts it, and hides on ×', async ($, on) => {
  engine(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const empty = await $.ui.mount({ plugin: 'agents-pane', surface, ...BAND })
    expect(await empty.find({ text: /aboard/ })).toBeUndefined()
    await empty.unmount()
  }

  await $.agent.spawn(spawn('Build the landing page'))
  await $.agent.spawn(spawn('Research competitor launches'))
  await $.turn.complete(finish('a2'))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'agents-pane', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: '1 aboard · 1 done' })).toBeDefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ plugin: 'agents-pane', surface: 'terminal', ...BAND })
  await ui.press({ key: 'hide' })
  expect(await ui.find({ text: /aboard/ })).toBeUndefined()
  await ui.unmount()
})

test('the pane tracks tools per agent and Clear drops the finished', async ($, on) => {
  const clock = engine(on)
  await $.agent.spawn(spawn('Build the landing page'))
  await $.agent.spawn(spawn('Research competitor launches'))
  await $.tool.call({ tool: 'Grep', pattern: 'x', agentId: 'a1' } as never)
  await $.tool.call({ tool: 'Read', file_path: '/a', agentId: 'a1' } as never)
  await clock.advance(17_000)
  await $.turn.complete(finish('a2'))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'agents-pane', surface, ...PANE })
    expect(await ui.find({ type: 'Text', text: 'In battle · 1' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '2 tools · Read' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /0:17/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Done · 1' })).toBeDefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ plugin: 'agents-pane', surface: 'desktop', ...PANE })
  await ui.press({ key: 'clear' })
  expect(await ui.find({ type: 'Text', text: /Done ·/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Build the landing page' })).toBeDefined()
  await ui.unmount()
})

test('each subagent boards as a Star Rail hero', async ($, on) => {
  engine(on)
  await $.agent.spawn(spawn('Build the landing page'))
  await $.agent.spawn(spawn('Research competitor launches'))

  const desk = await $.ui.mount({ plugin: 'agents-pane', surface: 'desktop', ...PANE })
  expect(await desk.find({ type: 'Text', text: /Imbibitor Lunae/ })).toBeDefined()
  expect(await desk.find({ type: 'Text', text: /Permansor Terrae/ })).toBeDefined()
  expect(await desk.find({ type: 'Svg' })).toBeDefined()
  await desk.unmount()

  const term = await $.ui.mount({ plugin: 'agents-pane', surface: 'terminal', ...PANE })
  expect(await term.find({ key: 'hero-a1' })).toBeDefined()
  await term.unmount()
})

test('the pane waits to be asked, the strip steps aside while it is up, and the clock ticks', async ($, on) => {
  const clock = engine(on, true)
  await $.agent.spawn(spawn('Build the landing page'))

  const band = await $.ui.mount({ plugin: 'agents-pane', surface: 'desktop', ...BAND })
  expect(await band.find({ text: /aboard/ })).toBeDefined()
  await band.press({ key: 'open' })
  expect(await band.find({ text: /aboard/ })).toBeUndefined()
  await band.unmount()

  const pane = await $.ui.mount({ plugin: 'agents-pane', surface: 'desktop', ...PANE })
  await clock.advance(3_000)
  expect(await pane.find({ type: 'Text', text: /0:03/ })).toBeDefined()
  await pane.unmount()
  await $.turn.complete(finish('a1'))
})

test('the strip holds a live battle while heroes fight, and rests after', async ($, on) => {
  engine(on)
  await $.agent.spawn(spawn('Build the landing page'))
  await $.agent.spawn(spawn('Research competitor launches'))

  const live = await $.ui.mount({ plugin: 'agents-pane', surface: 'desktop', ...BAND })
  expect(await live.find({ type: 'Svg' })).toBeDefined()
  await live.unmount()

  await $.turn.complete(finish('a1'))
  await $.turn.complete(finish('a2'))
  const done = await $.ui.mount({ plugin: 'agents-pane', surface: 'desktop', ...BAND })
  expect(await done.find({ text: '0 aboard · 2 done' })).toBeDefined()
  expect(await done.find({ type: 'Svg' })).toBeDefined()
  await done.unmount()
})

test('the pane leads with a scoreboard on desktop and stat tiles in the terminal', async ($, on) => {
  engine(on)
  await $.agent.spawn(spawn('Build the landing page'))
  await $.turn.complete(finish('a1'))

  const desk = await $.ui.mount({ plugin: 'agents-pane', surface: 'desktop', ...PANE })
  expect(await desk.find({ type: 'Svg' })).toBeDefined()
  expect(await desk.find({ type: 'Text', text: 'Battle time' })).toBeUndefined()
  await desk.unmount()

  const term = await $.ui.mount({ plugin: 'agents-pane', surface: 'terminal', ...PANE })
  expect(await term.find({ type: 'Text', text: 'Battle time' })).toBeDefined()
  expect(await term.find({ type: 'Text', text: 'W 1 · L 0' })).toBeDefined()
  await term.unmount()
})

test('a live hero plays their kit, and a named hero boards as named', async ($, on) => {
  engine(on)
  await $.agent.spawn(spawn('Firefly on the Express'))
  await $.agent.spawn(spawn('Research competitor launches'))

  const live = await $.ui.mount({ plugin: 'agents-pane', surface: 'desktop', ...PANE })
  expect(await live.find({ type: 'Text', text: /Firefly/ })).toBeDefined()
  expect(await live.find({ type: 'Text', text: /Imbibitor Lunae/ })).toBeDefined()
  const cards = (await live.findAll({ type: 'Svg' })) as unknown as { props: { source: string } }[]
  expect(cards.some(svg => svg.props.source.includes('Complete Combustion'))).toBe(true)
  expect(cards.some(svg => svg.props.source.includes("Azure's Aqua Ablutes All"))).toBe(true)
  for (const svg of cards) expect(svg.props.source.length).toBeLessThan(131072)
  await live.unmount()
})

test('the Express carries one window per working hero, up to four', async ($, on) => {
  engine(on)
  for (const name of ['Castorice', 'Firefly', 'Permansor Terrae', 'Imbibitor Lunae', 'Castorice again']) await $.agent.spawn(spawn(`${name} task`))
  const band = await $.ui.mount({ plugin: 'agents-pane', surface: 'desktop', ...BAND })
  const svg = (await band.find({ type: 'Svg' })) as unknown as { props: { source: string; alt: string } }
  expect(svg.props.source.length).toBeLessThan(131072)
  expect(svg.props.alt).toContain('aboard')
  expect(await band.find({ text: '5 aboard · 0 done' })).toBeDefined()
  await band.unmount()
})
