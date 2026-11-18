// VELDORA v6 — five story missions for the Veldora crew, in Aurel Bay.
// Jax Marlowe, ex-getaway driver, is back in town. Selene Voss fixes jobs; Ilya Kade runs the crew.
export const MISSIONS = [
  {
    id: 1, name: 'First Fare',
    brief: 'Selene: "Pick up the passenger at the plaza and drive them to the marina. No funny business."',
    objective: 'Drive the passenger to the marina',
    target: { x: -150, z: 20 },
    onStart(state) { state.say('Selene: "The fare is waiting at the plaza. Be polite, Jax."'); },
    check(state) { return state.inCar && Math.hypot(state.x - -150, state.z - 20) < 10; },
    reward: 400,
  },
  {
    id: 2, name: 'The Pickup',
    brief: 'Ilya: "A package is stashed in Old Town. Grab it on foot and bring it back — quietly."',
    objective: 'Collect the package in Old Town',
    target: { x: 88, z: -88 },
    onStart(state) { state.say('Ilya: "Old Town, blue door. Don\'t let the cops see you running."'); },
    check(state) { return !state.inCar && Math.hypot(state.x - 88, state.z - -88) < 6; },
    reward: 600,
  },
  {
    id: 3, name: 'Hot Wheels',
    brief: 'Selene: "The red Comet GT is parked by the marina. Steal it. It\'s the only one in the city."',
    objective: 'Steal the red Comet GT',
    target: { x: -150, z: 60 },
    onStart(state) { state.say('Selene: "Comet GT, marina car park. Walk up, press E, and go."'); },
    check(state) { return state.inCar && state.carName === 'Comet GT'; },
    reward: 800,
  },
  {
    id: 4, name: 'Heat Wave',
    brief: 'Ilya: "You\'re hot — three stars. Lose the tail, then lay low until it cools off."',
    objective: 'Lose 3 wanted stars',
    target: { x: 0, z: 0 },
    onStart(state) { state.setWanted(3); state.say('Ilya: "Three stars on you. Break line of sight and stay out of it."'); },
    check(state) { return state.wanted === 0; },
    reward: 900,
  },
  {
    id: 5, name: 'The Big Score',
    brief: 'Selene: "The Aurel Bank vault. Three guards, one vault, four stars when the alarm trips. Then vanish to the hideout."',
    objective: 'Crack the vault, then reach the hideout',
    target: { x: 44, z: 176 },
    onStart(state) {
      state.say('Selene: "Vault\'s at the bank. Guards will shoot. Hideout\'s in the hills — get there alive."');
      state.spawnGuards([{ x: 40, z: 132 }, { x: 48, z: 140 }, { x: 44, z: 124 }]);
      state.setWanted(4);
    },
    check(state) { return state.guardsLeft === 0 && Math.hypot(state.x - 44, state.z - 176) < 10; },
    reward: 2500,
  },
];

export function createMissions() {
  return {
    index: -1, // -1 = no mission yet
    current: null,
    start(i, state) {
      this.index = i; this.current = MISSIONS[i];
      this.current.onStart(state);
      return this.current;
    },
    complete(state) {
      const m = this.current;
      state.cash += m.reward;
      state.say(`Job done: ${m.name}. +$${m.reward}.`);
      this.current = null;
      return m;
    },
  };
}
