// VELDORA v6 — story dialogue lines, shown one at a time under the HUD.
export const STORY_LINES = {
  intro: 'Jax Marlowe came home to Aurel Bay with nothing but a busted car and a debt. The Veldora crew offered him five jobs — and a way out.',
  fare: 'The passenger tips well and says nothing. In this city, that is a compliment.',
  pickup: 'The package is light. Whatever is inside, it is not Jax\'s business. Not yet.',
  comet: 'The Comet GT purrs like it knows it is stolen. Selene will love this one.',
  heat: 'Sirens fade behind him. Aurel Bay forgets fast — if you let it.',
  score: 'The vault is open. The crew is rich. The only question left is who gets out of Aurel Bay alive.',
};

export function createStory() {
  let queue = [];
  return {
    queueLine(line) { queue.push(line); },
    next() { return queue.shift() || null; },
    clear() { queue = []; },
  };
}
