// Simple priority queue (binary heap) with an explicit comparison function.
export class Heap {
  constructor(before) { this.items = []; this.before = before; }
  get size() { return this.items.length; }
  push(x) { this.items.push(x); this.#up(this.items.length - 1); }
  pop() {
    const top = this.items[0], last = this.items.pop();
    if (this.items.length) { this.items[0] = last; this.#down(0); }
    return top;
  }
  toArray() { return [...this.items]; }
  #up(i) {
    const a = this.items;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.before(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]]; i = p;
    }
  }
  #down(i) {
    const a = this.items, n = a.length;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let best = i;
      if (l < n && this.before(a[l], a[best])) best = l;
      if (r < n && this.before(a[r], a[best])) best = r;
      if (best === i) return;
      [a[i], a[best]] = [a[best], a[i]]; i = best;
    }
  }
}
