// Style kit. Every colour comes from the cast and the office palette,
// so the UI and the characters read as one world.
import { FURNITURE, ROOM, INK } from "../palette.js";
import { CAST } from "../cast.js";
import { SWEATERS } from "../looks.js";

const [OLA, KUBA, BOSS] = CAST;

export const KIT = {
  ink: INK,                          // text
  cream: "#FFF8EE",                  // cards (Ola's collar)
  wall: ROOM.wall,
  floor: ROOM.floor,
  brown: ROOM.shadow,                // primary buttons
  graphite: BOSS.outfit.main,        // boards, top bar
  graphiteDark: BOSS.outfit.pants,
  screen: FURNITURE.screen,          // wall screens
  mustard: OLA.outfit.main,          // accent, line of the first model (my model)
  teal: OLA.mugColor,                // line of the second model (first comparison)
  lilac: SWEATERS.lilac,             // third model and later (with sky)
  sky: SWEATERS.sky,
  legit: KUBA.outfit.main,           // blue = legit transaction
  fraud: BOSS.outfit.tie,            // red = fraud
  caught: FURNITURE.screenLine,      // green = caught
  navy: KUBA.outfit.tie,
};

/** Spacing scale (px), radii (px), one font. */
export const SPACE = [4, 8, 12, 16, 24, 32];
export const RADIUS = { chip: 999, button: 10, card: 14, screen: 8 };
export const FONT = "Nunito";
