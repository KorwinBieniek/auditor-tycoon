// Character poses. Everything in SVG units, the figure faces right.
// Legs are in world coordinates (y = 0 is the floor).
// Arms are in upper-body coordinates (y = 0 is the hips), because breathing scales the torso with the arms.
// An arm is 3 points: shoulder, elbow, hand. "far" is the arm/leg further from the viewer (behind the torso).

const SEATED_LEGS = { far: [[-2, -74], [38, -74], [40, -10]], near: [[4, -72], [44, -72], [46, -10]] };
const SEATED_ARMS = { far: [[-4, -72], [18, -47], [45, -41]], near: [[6, -70], [24, -44], [52, -38]] };
// Both arms up from the torso edge (seated stretch).
function armsUp({ R, neckY }) {
  const y = neckY + 11;
  return { far: [[-(R - 5), y], [-(R + 8), y - 24], [-(R + 2), y - 52]], near: [[R - 5, y], [R + 8, y - 24], [R + 2, y - 52]] };
}

export const POSES = {
  // standing: arms along the body
  standing: {
    label: "Standing",
    seated: false,
    hipY: -44,
    expression: "neutral",
    legs: { far: [[-7, -50], [-8, -8]], near: [[7, -50], [8, -8]] },
    arms: { far: [[-10, -70], [-14, -44], [-16, -20]], near: [[9, -70], [13, -44], [15, -21]] },
    // a figure with a mug holds it in front
    armsWithMug: { far: [[-10, -70], [-14, -44], [-16, -20]], near: [[9, -70], [13, -42], [31, -47]] },
  },
  // typing: seated on a chair, hands on the keyboard
  typing: {
    label: "Typing at the computer",
    seated: true,
    typing: true,
    hipY: -64,
    expression: "focused",
    legs: { far: [[-2, -74], [38, -74], [40, -10]], near: [[4, -72], [44, -72], [46, -10]] },
    arms: { far: [[-4, -72], [18, -47], [45, -41]], near: [[6, -70], [24, -44], [52, -38]] },
  },
  // joy: arms up, small jumps.
  // Arms start at the torso edge (shoulder on the outline), so they are computed from the width R
  // and the collar height neckY. shoulderCap draws a rounded shoulder joining the arm to the torso.
  joy: {
    label: "Joy",
    seated: false,
    jumps: true,
    hipY: -44,
    expression: "happy",
    shoulderCap: true,
    nearArmShade: 0,   // near arm in the torso colour so the shoulder blends into the sleeve
    legs: { far: [[-7, -50], [-11, -8]], near: [[7, -50], [11, -8]] },
    arms: ({ R, neckY }) => {
      const y = neckY + 11;   // shoulder height
      return {
        far: [[-(R - 5), y], [-(R + 11), y - 22], [-(R + 15), y - 50]],
        near: [[R - 5, y], [R + 11, y - 22], [R + 15, y - 50]],
      };
    },
  },
  // Game poses: built from the same pieces, used by the office.
  // sit: seated, hands resting on the keyboard (no typing animation)
  sit: { label: "Sitting", seated: true, hipY: -64, expression: "neutral", legs: SEATED_LEGS, arms: SEATED_ARMS },
  // look: seated, turned to a colleague who just caught a fraud
  look: { label: "Looking", seated: true, hipY: -64, expression: "happy", legs: SEATED_LEGS, arms: SEATED_ARMS },
  // stretch: seated, arms up
  stretch: { label: "Stretching", seated: true, hipY: -64, expression: "tired", shoulderCap: true, nearArmShade: 0,
    legs: SEATED_LEGS, arms: armsUp },
  // phone: seated, near hand at the ear holding a phone
  phone: { label: "On the phone", seated: true, hipY: -64, expression: "neutral", prop: "phone", legs: SEATED_LEGS,
    arms: ({ R, headCY }) => ({ far: SEATED_ARMS.far, near: [[6, -70], [R * 0.75, -82], [R * 0.15, headCY + 12]] }) },
  // walk: two steps of a walk cycle
  walk1: { label: "Walking 1", seated: false, hipY: -44, expression: "neutral",
    legs: { far: [[-7, -50], [-19, -8]], near: [[7, -50], [19, -8]] },
    arms: { far: [[-10, -70], [-4, -44], [6, -22]], near: [[9, -70], [3, -44], [-8, -22]] },
    armsWithMug: { far: [[-10, -70], [-4, -44], [6, -22]], near: [[9, -70], [13, -42], [31, -47]] } },
  walk2: { label: "Walking 2", seated: false, hipY: -45, expression: "neutral",
    legs: { far: [[-7, -50], [4, -8]], near: [[7, -50], [-3, -8]] },
    arms: { far: [[-10, -70], [-18, -44], [-24, -22]], near: [[9, -70], [17, -44], [22, -22]] },
    armsWithMug: { far: [[-10, -70], [-18, -44], [-24, -22]], near: [[9, -70], [13, -42], [31, -47]] } },
  // grab: standing, hands on the head (the boss when a fraud slips through)
  grab: { label: "Hands on head", seated: false, hipY: -44, expression: "panic", shoulderCap: true, nearArmShade: 0,
    legs: { far: [[-7, -50], [-9, -8]], near: [[7, -50], [9, -8]] },
    arms: ({ R, neckY, headCY }) => {
      const y = neckY + 11;
      return { far: [[-(R - 5), y], [-(R + 16), headCY + 30], [-(R + 2), headCY + 4]],
        near: [[R - 5, y], [R + 16, headCY + 30], [R + 2, headCY + 4]] };
    } },
};
