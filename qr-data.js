// Map decoded QR text -> what to display/speak.
// Use your real node IDs or messages here.
const qrData = {
  red: {
    NENT: {
      text: "You are at the entrance. Walk straight to the main walkway.",
      voice: "You are at the entrance. Walk straight to the main walkway.",
    },
    NWAY: {
      text: "You are in the walkway. The FGO office is on your right.",
      voice: "You are in the walkway. The FGO office is on your right.",
    },
    NFGO: {
      text: "You are at the FGO office. Turn around to return to the entrance.",
      voice:
        "You are at the FGO office. Turn around to return to the entrance.",
    },
  },
  green: {
    N001: {
      text: "You are at Room N zero zero one.",
      voice: "You are at Room N zero zero one.",
    },
    N002: {
      text: "You are at Room N zero zero two.",
      voice: "You are at Room N zero zero two.",
    },
    N011: {
      text: "You are at Room N zero one one.",
      voice: "You are at Room N zero one one.",
    },
  },
  blue: {
    NEXIT: {
      text: "You are at the emergency exit. Proceed outside carefully.",
      voice: "You are at the emergency exit. Proceed outside carefully.",
    },
    NEXT: {
      text: "You are near the fire extinguisher.",
      voice: "You are near the fire extinguisher.",
    },
    NFIRST: {
      text: "You are at the first aid station.",
      voice: "You are at the first aid station.",
    },
  },
};
