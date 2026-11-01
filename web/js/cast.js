// Cast: character descriptions as plain parameter objects.
// To add a new auditor, add another object.
import { SKIN, HAIR } from "./palette.js";

export const CAST = [
  {
    id: "ola",
    name: "Ola",
    role: "Auditor",
    skin: SKIN.light,
    hair: { style: "bun", color: HAIR.red },
    outfit: { type: "sweater", main: "#E9A23B", collar: "#FFF8EE", pants: "#3E4A6B", shoes: "#6B4232" },
    accessories: ["headphones", "mug"],
    mugColor: "#5FA8A0",
    bodyWidth: 62,
    bodyHeight: 146,
  },
  {
    id: "kuba",
    name: "Kuba",
    role: "Auditor",
    skin: SKIN.dark,
    hair: { style: "curls", color: HAIR.black },
    outfit: { type: "shirt", main: "#8CC3D3", tie: "#2F4A7A", pants: "#5A4A3E", shoes: "#2B2B2E" },
    accessories: ["glasses"],
    glassesColor: "#D08A3C",
    bodyWidth: 64,
    bodyHeight: 152,
  },
  {
    id: "boss",
    name: "Pan Marek",
    role: "Boss",
    skin: SKIN.light,
    hair: { style: "receding", color: HAIR.grey },
    outfit: { type: "suit", main: "#4B5568", shirt: "#FFFFFF", tie: "#C8463D", pants: "#3A4152", shoes: "#1E1E22" },
    accessories: ["moustache", "mug"],
    mugColor: "#F4F1EA",
    bodyWidth: 72,
    bodyHeight: 158,
  },
];
