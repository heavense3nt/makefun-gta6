// story.js — the people and the plot of VELDORA. All names, places and lines
// are original: nothing here comes from any commercial game.
export const CHARACTERS = {
  kai: { name: 'Kai Reyes', role: 'You — a driver for hire new to Solmar Bay' },
  mara: { name: 'Mara Voss', role: 'Fixer for the Veldora crew, runs the marina bar' },
  denton: { name: 'Denton Hale', role: 'Rival crew boss, owns the north docks' },
  lena: { name: 'Lena Ortiz', role: 'Mechanic at the Suncoast Garage' },
  officer: { name: 'Officer Brandt', role: 'Solmar Bay PD, very patient, very armed' },
};

export const STORY_INTRO = [
  ['Mara Voss', 'Kai. You made it to Solmar Bay. Good — the crew needs a driver who doesn\'t ask questions.'],
  ['Mara Voss', 'Five jobs. Do them clean, do them fast, and the bay is yours. First one\'s easy: a fare across town.'],
  ['Kai Reyes', 'Easy money. I like easy money.'],
];

export const MISSION_BRIEFS = [
  {
    title: '1 · FIRST FARE',
    brief: 'Pick up the client at the marina and drive him to the north plaza. Don\'t scratch the car. Don\'t get the cops involved.',
    lines: [['Mara Voss', 'Client\'s waiting by the pier, black suit, red tie. Get him to the plaza before his meeting. Smooth driving, Kai.']],
  },
  {
    title: '2 · THE PICKUP',
    brief: 'A package is waiting in the alley behind the Suncoast Garage. Grab it on foot and bring it back to Mara at the marina.',
    lines: [['Lena Ortiz', 'Package is in the alley, under the blue tarp. Denton\'s boys are sniffing around, so keep your head down.']],
  },
  {
    title: '3 · HOT WHEELS',
    brief: 'Denton keeps a red sports car parked outside his casino. Steal it and deliver it to Lena\'s garage. Expect company.',
    lines: [['Mara Voss', 'Denton\'s pride and joy, parked right out front like he owns the street. Take it. Lena will make it disappear.']],
  },
  {
    title: '4 · HEAT WAVE',
    brief: 'You\'re at 3 stars and the whole department is on you. Lose them — stay out of sight until the heat dies, or outrun them all.',
    lines: [['Officer Brandt', 'All units, suspect is in the downtown grid. Box him in. Do not let him reach the beach road.']],
  },
  {
    title: '5 · THE BIG SCORE',
    brief: 'The Meridian Bank vault. Grab the cash, fight past Denton\'s guards, then lose a 4-star wanted level and reach the hideout.',
    lines: [
      ['Mara Voss', 'This is the one, Kai. The vault, the guards, the whole department — then the hideout, and we\'re legends.'],
      ['Denton Hale', 'That vault is mine, Reyes. My boys won\'t let you walk out of there.'],
    ],
  },
];

export const MISSION_COMPLETE = [
  'Clean work, Kai. The crew is talking about you.',
  'Package delivered. Mara owes you one.',
  'Lena\'s already stripping that sports car. Beautiful.',
  'You lost the whole department. Nobody does that.',
  'The Big Score is ours. Solmar Bay belongs to the Veldora crew now.',
];

export const FAIL_LINES = {
  busted: 'The Solmar Bay police finally caught up with you.',
  died: 'Solmar Bay is a rough town. The crew will remember you.',
  carLost: 'The car is gone. The job is blown.',
};
