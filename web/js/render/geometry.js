// Scene geometry in pixels of a fixed 1440 x 840 office (below the 60 px top bar). The whole scene is
// scaled to fit the window.
// Wall boxes, row floor lines, aisles and the camera limits are explicit layout choices.
import { FRAMING } from "../framing.js";

const ROOM = FRAMING.room;
export const SCENE = { w: 1440, h: 840, wallBottom: ROOM.wallBottom, tickerTop: 772 };

export const WALL = {
  door: ROOM.door,                                  // framing.js (front left)
  window: { x: 98, y: 112, w: 250, h: 196 },
  sign: { x: 370, y: 112, w: 600, h: 40 },
  clock: { cx: 1232, cy: 214, r: 34 },             // free wall between the profit screen and the meeting room
  scoreScreen: { x: 370, y: 162, w: 360, h: 178 },
  profitScreen: { x: 746, y: 162, w: 360, h: 178 },
  glass: ROOM.glass,                                // meeting room (framing.js)
  server: ROOM.server,
  scoreboard: { x: 150, y: 4, w: 1000, h: 104 },   // ends before the glass meeting room
};

// Floor line of each row (row 0 = front). Behind the back row the floor ends at the wall.
export const ROW_FLOOR = FRAMING.rowFloor;   // framing.js
export const BACK_FLOOR = ROOM.wallBottom + 12;
export const COFFEE = ROOM.coffee;
// Where a person stands for coffee, next to the machine (screen px).
export const COFFEE_SPOT = ROOM.coffeeSpot;
export const MEETING_UNIT = ROOM.meetingUnit;
export const FRONT_UNIT = 0.6;

// Walking lanes in screen pixels: the left aisle (door side) has one x for people coming in and one
// for people leaving, so they never meet face to face; Pan Marek uses the right aisle.
export const AISLE = { inX: 44, outX: 90, bossX: 1392, coffeeX: ROOM.coffeeAisleX };
export const DOOR_POINT = ROOM.doorPoint;
// Lanes behind each row as a share of the gap to the next row: in-lane and out-lane.
export const LANE_SHARE = { in: 0.3, out: 0.62 };

// Pan Marek: his spot in the right aisle and where he stops to look at the wall screens.
export const BOSS_HOME = { x: 1392, y: 772 };
export const BOSS_LOOK = { x: 1330, y: 772 };   // a step towards the room on the front plane, looking up at the screens

// Envelopes: they leave the server rack low (its bottom slot), fly to a split point above the team
// and split there. They never rise into the wall screens: the highest envelope pixel (its score pill,
// ENVELOPE_TOP above its centre) stays below the lowest screen edge.
export const ENVELOPE_TOP = 17;
export const WALL_SCREENS = [WALL.scoreScreen, WALL.profitScreen, WALL.sign, WALL.scoreboard, WALL.window];
export const ENVELOPE_CLEAR_Y = Math.max(...WALL_SCREENS.map((b) => b.y + b.h)) + ENVELOPE_TOP + 3;
export const RACK_OUT = { x: 1380, y: ENVELOPE_CLEAR_Y };
export const SPLIT_Y = 400;

// Camera: zooms the floor (not the wall) around the bottom centre. It frames the occupied rows plus
// one free row, keeps the top of that row below SCREEN_TOP and every desk between the aisles.
// maxX: occupied rows stay left of the coffee machine (COFFEE.x - 24 px half width - 12 px gap) at any zoom
export const CAMERA = { anchorX: 720, anchorY: 768, screenTop: ROOM.screenTop, minX: 112, maxX: ROOM.coffee.x - 36, maxZoom: 1.2, snap: 1.02, rate: 3 };

