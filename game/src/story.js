// VELDORA v7 — the story of the Veldora crew, told in short lines.
// Kai Reyes is a wheelman new to Solmar Bay; Mara Voss runs the crew;
// Denton Hale is the detective who never stops watching.
export const CREW = {
  kai: 'Kai Reyes',
  mara: 'Mara Voss',
  hale: 'Denton Hale',
};

export const DIALOGUE = {
  intro: [
    ['Mara', 'Kai. Solmar Bay. Five jobs, one crew. You drive, we eat.'],
    ['Kai', 'Just point me at the wheel, Mara.'],
  ],
  mission1: [
    ['Mara', 'First fare: a taxi is waiting at the stand. Take it to the marina.'],
    ['Kai', 'A taxi? I was promised a getaway car.'],
    ['Mara', 'Every legend starts with a fare, Kai.'],
  ],
  mission2: [
    ['Mara', 'Package in the alley behind the arcade. No cops, no noise.'],
    ['Kai', 'Copy. Quiet as the tide.'],
  ],
  mission3: [
    ['Mara', 'Red sports car, showroom lot. It is ours now — take it.'],
    ['Kai', 'Now we are talking.'],
  ],
  mission4: [
    ['Mara', 'Three stars, Kai. Hale has every cruiser on you. Vanish.'],
    ['Hale', 'Reyes! This city has eyes everywhere.'],
  ],
  mission5: [
    ['Mara', 'The Big Score. Bank vault, guards, and a long drive home.'],
    ['Kai', 'Then we are legends, Mara.'],
  ],
  busted: [
    ['Hale', 'Got you, Reyes. Solmar Bay always collects.'],
  ],
  done: [
    ['Mara', 'Five jobs. Clean. The crew eats tonight, Kai.'],
    ['Kai', 'Same time tomorrow?'],
  ],
};

export function missionBrief(id) {
  const key = `mission${id}`;
  return DIALOGUE[key] || [];
}
