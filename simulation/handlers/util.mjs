// @purpose Shared helpers for the simulation - random delay + random failure injector.
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export function randDelay(min, max) {
  return sleep(min + Math.random() * (max - min))
}

export function maybeFail(rate, label) {
  if (Math.random() < rate) {
    throw new Error(`simulated failure in ${label}`)
  }
}
