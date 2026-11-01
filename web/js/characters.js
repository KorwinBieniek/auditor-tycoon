// Building a character from parameters.
// Main idea (Headspace-like): head and torso are ONE elongated rounded shape.
// Outfit, face, hair and accessories are drawn on it; arms and legs are simple rounded lines.
//
// Usage:
//   const c = createCharacter(CHARACTER_DESCRIPTION, "typing");
//   svg.appendChild(c.group);
//   c.update(timeInSeconds);   // called from one requestAnimationFrame loop
import { el, shade, polyline, uniqueId } from "./svg.js";
import { ROOM } from "./palette.js";
import { drawFace, drawEar, EXPRESSIONS } from "./face.js";
import { drawHair } from "./hair.js";
import { drawOutfit, sleeveColor, cuffColor } from "./outfit.js";
import { drawHeadAccessories, drawMug } from "./accessories.js";
import { POSES } from "./poses.js";

const LIMB_WIDTH = 11;   // arm thickness
const LEG_WIDTH = 14;    // leg thickness

// Size of the head + torso shape, computed from the character parameters.
export function bodyGeometry(p) {
  const R = p.bodyWidth / 2;
  const H = p.bodyHeight;
  const headCY = -H + R;          // head centre (upper semicircle of the shape)
  return { R, H, headCY, neckY: headCY + R + 6, eyeY: headCY + 2 };
}

// Leg: thigh/shin as a line and the shoe as an ellipse pointing right.
function drawLeg(g, points, pantsColor, shoeColor) {
  el("path", { d: polyline(points), stroke: pantsColor, "stroke-width": LEG_WIDTH, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
  const [fx, fy] = points[points.length - 1];
  el("ellipse", { cx: fx + 5, cy: fy + 3, rx: 11, ry: 5.5, fill: shoeColor }, g);
}

// Arm: sleeve (line), optional cuff and hand (circle). Returns the elements to animate the hand.
function drawArm(g, points, sleeve, cuff, skin) {
  const path = el("path", { stroke: sleeve, "stroke-width": LIMB_WIDTH, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
  const cuffEl = cuff ? el("path", { stroke: cuff, "stroke-width": LIMB_WIDTH + 0.5, "stroke-linecap": "butt" }, g) : null;
  const hand = el("circle", { r: 6.2, fill: skin }, g);
  const arm = { path, cuffEl, hand, base: points };
  setArm(arm, 0, 0);
  return arm;
}

// Sets the arm with a hand offset (dx, dy); the elbow moves by half.
function setArm(arm, dx, dy) {
  const [s, e, h] = arm.base;
  const elbow = [e[0] + dx / 2, e[1] + dy / 2];
  const hand = [h[0] + dx, h[1] + dy];
  arm.path.setAttribute("d", polyline([s, elbow, hand]));
  arm.hand.setAttribute("cx", hand[0]);
  arm.hand.setAttribute("cy", hand[1]);
  if (arm.cuffEl) {
    // the cuff is a short segment of the forearm just before the hand
    const vx = hand[0] - elbow[0], vy = hand[1] - elbow[1];
    const len = Math.hypot(vx, vy) || 1;
    const p1 = [hand[0] - (vx / len) * 9, hand[1] - (vy / len) * 9];
    const p2 = [hand[0] - (vx / len) * 4, hand[1] - (vy / len) * 4];
    arm.cuffEl.setAttribute("d", polyline([p1, p2]));
  }
}

// Shoulder: a rounded shape in the sleeve colour on the torso edge,
// so a raised arm grows out of the body instead of looking glued on.
// Its centre is slightly inside the torso and above the arm start so it does not stick out under the armpit.
function drawShoulder(g, [x, y], color) {
  const inward = x > 0 ? -2 : 2;
  el("circle", { cx: x + inward, cy: y - 3, r: 9, fill: color }, g);
}

// Upper body: head + torso shape, outfit, face, hair, accessories, arms.
function drawUpperBody(root, p, pose, expression, geo) {
  const upper = el("g", { class: "upper" }, root);
  const holdsMug = !pose.seated && p.accessories.includes("mug") && pose.armsWithMug;
  const armSpec = holdsMug ? pose.armsWithMug : pose.arms;
  // arms can be fixed points or a function of the character size
  const arms = typeof armSpec === "function" ? armSpec(geo) : armSpec;
  const sleeve = sleeveColor(p.outfit);
  const cuff = cuffColor(p.outfit);

  const nearShade = pose.nearArmShade ?? -0.1;   // by default the near arm is slightly darker than the torso
  const farColor = shade(sleeve, -0.22), nearColor = shade(sleeve, nearShade);
  if (pose.shoulderCap) drawShoulder(upper, arms.far[0], farColor);
  const farArm = drawArm(upper, arms.far, farColor, cuff && shade(cuff, -0.15), shade(p.skin, -0.12));

  // one rounded shape: head and torso
  const clipId = uniqueId("body");
  const clip = el("clipPath", { id: clipId }, el("defs", {}, upper));
  const capsule = { x: -geo.R, y: -geo.H, width: 2 * geo.R, height: geo.H, rx: geo.R };
  el("rect", capsule, clip);
  el("rect", { ...capsule, fill: p.skin }, upper);
  drawOutfit(upper, p.outfit, geo, clipId);

  const face = drawFace(upper, expression, p.skin, shade(p.hair.color, -0.25), geo);
  drawEar(upper, p.skin, geo);
  drawHair(upper, p.hair.style, p.hair.color, geo);
  drawHeadAccessories(upper, p, geo);

  if (holdsMug) drawMug(upper, arms.near[2][0] + 6, arms.near[2][1] + 7, p.mugColor);
  if (pose.shoulderCap) drawShoulder(upper, arms.near[0], nearColor);
  if (pose.prop === "phone") drawPhone(upper, arms.near[2]);
  const nearArm = drawArm(upper, arms.near, nearColor, cuff, p.skin);
  return { upper, face, farArm, nearArm };
}

// Phone held at the ear (drawn under the near hand).
function drawPhone(g, [x, y]) {
  el("rect", { x: x - 3, y: y - 12, width: 7, height: 15, rx: 2, fill: "#2F3540" }, g);
}

// Creates a character in a pose. Returns the SVG group and an update(t) function for animation.
export function createCharacter(p, poseName, options = {}) {
  const pose = POSES[poseName];
  const expression = options.expression || pose.expression;
  const geo = bodyGeometry(p);
  const root = el("g", { class: `character ${p.id} pose-${poseName}` });
  const shadow = el("ellipse", { cx: 4, cy: 0, rx: geo.R + 2, ry: 4, fill: ROOM.shadow, opacity: 0.16 }, root);
  if (pose.seated) shadow.setAttribute("opacity", 0);

  const legs = el("g", { class: "legs" }, root);
  drawLeg(legs, pose.legs.far, shade(p.outfit.pants, -0.2), shade(p.outfit.shoes, -0.15));
  drawLeg(legs, pose.legs.near, p.outfit.pants, p.outfit.shoes);

  const parts = drawUpperBody(root, p, pose, expression, geo);
  const phase = options.phase || 0;   // animation offset so characters do not move in sync

  function update(t) {
    const time = t + phase;
    // breathing: the torso stretches and shrinks slightly
    const breathe = 1 + 0.012 * Math.sin((time * 2 * Math.PI) / 3.2);
    parts.upper.setAttribute("transform", `translate(0 ${pose.hipY}) scale(1 ${breathe})`);
    animateBlink(parts.face, time);
    if (pose.typing) animateTyping(parts, time);
    if (pose.jumps) animateJoy(root, shadow, parts, time);
  }
  update(0);
  return { group: root, update, geometry: geo };
}

// Blinking: about every 4 seconds the eyes close briefly.
function animateBlink(face, time) {
  if (!face.canBlink) return;
  const cycle = time % 4.1;
  const s = cycle < 0.13 ? 0.12 : 1;
  const y = face.eyeY;
  face.eyes.setAttribute("transform", `translate(0 ${y}) scale(1 ${s}) translate(0 ${-y})`);
}

// Typing: hands hit the keyboard in turn.
function animateTyping(parts, time) {
  const speed = 15;
  parts.nearArm && setArm(parts.nearArm, 0, -2.6 * Math.max(0, Math.sin(time * speed)));
  parts.farArm && setArm(parts.farArm, 0, -2.6 * Math.max(0, Math.sin(time * speed + Math.PI)));
}

// Joy: jumps and waving arms.
function animateJoy(root, shadow, parts, time) {
  const jump = Math.abs(Math.sin(time * Math.PI * 1.4));
  root.setAttribute("transform", `translate(0 ${-9 * jump})`);
  shadow.setAttribute("transform", `translate(0 ${9 * jump}) scale(${1 - 0.25 * jump} 1)`);
  const wave = 2.5 * Math.sin(time * 9);
  setArm(parts.nearArm, wave, -wave);
  setArm(parts.farArm, -wave, wave);
}

export { EXPRESSIONS, POSES };
