/** A set of listeners to call together; `add` returns a function that removes the one added. */
export interface Listeners<A extends unknown[]> {
  add(listener: (...args: A) => void): () => void;
  emit(...args: A): void;
}

export function createListeners<A extends unknown[]>(): Listeners<A> {
  const listeners = new Set<(...args: A) => void>();
  return {
    add(listener) {
      // Wrapped, so the same function added twice is two listeners.
      const wrapped = (...args: A) => listener(...args);
      listeners.add(wrapped);
      return () => void listeners.delete(wrapped);
    },
    emit(...args) {
      for (const listener of listeners) listener(...args);
    },
  };
}
