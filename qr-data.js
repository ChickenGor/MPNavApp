const qrData = {
  red: {
    "R_ENTR": { 
      text: "Block N Entrance", 
      voice: "You are at the Block N Entrance. Walk straight ahead to the walkway.", 
      category: "entrance", 
      next: "R_WALKWAY" 
    },
    "R_WALKWAY": { 
      text: "Walkway", 
      voice: "You are on the walkway. Turn left to reach Room 101, or continue straight for Room 102.", 
      category: "hallway",
      next: "R_ROOM101"
    },
    "R_ROOM101": { 
      text: "Room 101", 
      voice: "You have arrived at Room 101. To reach Room 102, return to the walkway and go straight.", 
      category: "room",
      next: "R_ROOM102"
    },
    "R_ROOM102": { 
      text: "Room 102", 
      voice: "You have arrived at Room 102. This is the last stop on the ground floor.", 
      category: "room"
    }
  },
  green: {
    "G_SILVERLAKE": { 
      text: "Silverlake Lab", 
      voice: "You are at Silverlake Lab. Proceed carefully inside.", 
      category: "lab" 
    },
    "G_HUAWEI": { 
      text: "Huawei Lab", 
      voice: "You are at Huawei Lab. Follow lab safety rules.", 
      category: "lab" 
    }
  },
  blue: {
    "B_TOILET": { 
      text: "Restrooms", 
      voice: "Restrooms are this way", 
      category: "facility" 
    },
    "B_EXIT": { 
      text: "Emergency Exit", 
      voice: "Follow this to the Emergency Exit", 
      category: "exit" 
    }
  }
};