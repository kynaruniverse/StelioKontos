/* SIDEQUEST / POCKET ARCADE — typed content model for the route selector and prompt machine. */

export const routeData = {
  make: {
    label: "MAKE",
    number: "01",
    color: "red",
    eyebrow: "For restless hands",
    title: "Make a tiny thing.",
    description: "A five-minute creative prompt to get an idea out of your head and onto the page.",
    action: "Give me a prompt",
    result: "Build a one-screen website for something that does not exist yet.",
  },
  wander: {
    label: "WANDER",
    number: "02",
    color: "blue",
    eyebrow: "For curious minds",
    title: "Go somewhere weird.",
    description: "A small detour through a curious link, a strange fact, or a question worth carrying around.",
    action: "Open a detour",
    result: "Look up the oldest object in your room. Give it a new job.",
  },
  play: {
    label: "PLAY",
    number: "03",
    color: "yellow",
    eyebrow: "For five spare minutes",
    title: "Play without winning.",
    description: "A low-pressure micro-challenge with no score, no streak, and no need to tell anyone.",
    action: "Start a round",
    result: "Draw a map of your morning using only arrows and circles.",
  },
} as const;

export type RouteKey = keyof typeof routeData;

export const prompts = [
  "Write the instruction manual for an object you use every day.",
  "Invent a holiday for a feeling that has no name yet.",
  "Take one boring sentence and make it sound like a movie trailer.",
  "Make a list of ten things that are better in the rain.",
  "Design a logo for a club that only meets in your imagination.",
] as const;
