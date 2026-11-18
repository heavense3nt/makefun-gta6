// VELDORA v6 — deterministic seeded random so the city is the same every visit.
export function createRandom(seed) {
  let s = seed >>> 0;
  return {
    next() {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    },
    range(lo, hi) { return lo + this.next() * (hi - lo); },
    int(lo, hi) { return Math.floor(this.range(lo, hi + 1)); },
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; },
  };
}
