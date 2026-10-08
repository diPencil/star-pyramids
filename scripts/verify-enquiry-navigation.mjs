import assert from 'node:assert/strict'
import { installEnquiryHistoryTracking, protectEnquiryNavigation } from '../lib/enquiry-navigation.ts'

function fixture(modern, uuid = true) {
  const browser = new EventTarget()
  const entries = [{ key: 'first', index: 0, state: { __NA: true } }]
  let index = 0
  browser.crypto = uuid ? { randomUUID: () => 'test-document' } : {}
  browser.location = { href: 'https://example.test/admin/inbox' }
  const navigation = new EventTarget()
  Object.defineProperty(navigation, 'currentEntry', { get: () => entries[index] })
  function traverse(target, cancelable = true) {
    const event = Object.assign(new Event('navigate', { cancelable }), {
      navigationType: 'traverse', destination: { ...entries[target], sameDocument: true },
    })
    navigation.dispatchEvent(event)
    if (event.defaultPrevented) return
    index = target
    navigation.dispatchEvent(new Event('currententrychange'))
    browser.dispatchEvent(Object.assign(new Event('popstate'), { state: entries[index].state }))
  }
  navigation.traverseTo = (key) => traverse(entries.findIndex((entry) => entry.key === key))
  browser.history = {
    get state() { return entries[index].state },
    replaceState(state) { entries[index].state = state },
    pushState(state) { entries.splice(index + 1); index++; entries.push({ key: `entry-${index}`, index, state }) },
    go(delta) { queueMicrotask(() => traverse(index + delta, false)) },
  }
  if (modern) browser.navigation = navigation
  else { installEnquiryHistoryTracking(browser); installEnquiryHistoryTracking(browser) }
  browser.history.pushState({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: 'preserved' }, '', '/admin/inbox')
  let dirty = false
  let pending = null
  let prompts = 0
  const cleanup = protectEnquiryNavigation(browser, () => dirty, (action) => { if (!pending) { prompts++; pending = action } })
  return {
    browser, traverse, cleanup, get index() { return index }, get prompts() { return prompts },
    hash() {
      entries.splice(index + 1); index++; entries.push({ key: `hash-${index}`, index, state: null })
      browser.dispatchEvent(Object.assign(new Event('popstate'), { state: null }))
      browser.dispatchEvent(new Event('hashchange'))
    },
    set dirty(value) { dirty = value },
    cancel() { pending = null },
    confirm() { dirty = false; const action = pending; pending = null; action?.() },
  }
}
const settle = () => new Promise((resolve) => setImmediate(resolve))
for (const [modern, uuid] of [[true, true], [false, true], [false, false]]) {
  const test = fixture(modern, uuid)
  assert.equal(test.browser.history.state.__PRIVATE_NEXTJS_INTERNALS_TREE, 'preserved')
  test.traverse(0); assert.equal(test.index, 0); assert.equal(test.prompts, 0)
  test.traverse(1); assert.equal(test.index, 1)
  test.dirty = true
  test.traverse(0); await settle()
  assert.equal(test.index, 1); assert.equal(test.prompts, 1)
  test.cancel(); test.traverse(0, false); await settle()
  assert.equal(test.index, 1); assert.equal(test.prompts, 2)
  test.confirm(); await settle(); assert.equal(test.index, 0)
  // Forward, cancel and retry, then save and navigate normally.
  test.dirty = true; test.traverse(1); await settle()
  assert.equal(test.index, 0); assert.equal(test.prompts, 3)
  test.cancel()
  // Failed save leaves dirty state and unload/history protection intact.
  const unload = Object.assign(new Event('beforeunload', { cancelable: true }), { returnValue: undefined })
  test.browser.dispatchEvent(unload); assert.equal(unload.defaultPrevented, true)
  test.traverse(1, false); await settle(); assert.equal(test.index, 0); assert.equal(test.prompts, 4)
  test.cancel(); test.dirty = false
  const cleanUnload = new Event('beforeunload', { cancelable: true })
  test.browser.dispatchEvent(cleanUnload); assert.equal(cleanUnload.defaultPrevented, false)
  test.traverse(1); assert.equal(test.index, 1); assert.equal(test.prompts, 4)
  if (!modern) {
    test.hash(); assert.equal(test.index, 2)
    test.dirty = true; test.traverse(1, false); await settle()
    assert.equal(test.index, 2); assert.equal(test.prompts, 5)
    test.confirm(); await settle(); assert.equal(test.index, 1)
  }
  test.cleanup(); test.dirty = true
  const removedUnload = new Event('beforeunload', { cancelable: true })
  test.browser.dispatchEvent(removedUnload); assert.equal(removedUnload.defaultPrevented, false)
  console.log(`PASS ${modern ? 'Navigation API' : `History API fallback (randomUUID ${uuid ? 'available' : 'absent'})`}: clean/dirty Back and Forward, cancel/confirm, non-cancelable restore, failed-save guard, saved baseline, cleanup`)
}
