require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { db } = require("./config/firebase");

const app = express();
app.use(express.json());
app.use(cors());

// Routes
app.use("/availability", require("./routes/availability"));
app.use("/teams", require("./routes/teams"));

// Health check
app.get("/", (req, res) => {
  res.send("Availability Backend is running");
});

//// Clear team's schedule
app.get("/teams/clear/:guildId/:userId", async (req, res) => {
  const API_URL = process.env.API_URL || "http://localhost:3000";
  try {
    const { guildId, userId } = req.params;

    const teamSnapshot = await db
      .collection("teams")
      .where("guildId", "==", guildId)
      .where("createdBy", "==", userId)
      .limit(1)
      .get();

    if (teamSnapshot.empty) {
      return res.status(403).json({
        success: false,
        message: "You are not the creator of any team in this guild.",
      });
    }
    const team = {
      id: teamSnapshot.docs[0].id,
      ...teamSnapshot.docs[0].data(),
    };
    const teamMembers = team.members;
    for (const memberId of teamMembers) {
      const availabilitySnapshot = await db
        .collection("availabilities")
        .where("guildId", "==", guildId)
        .where("userId", "==", memberId)
        .get();

      if (availabilitySnapshot.empty) {
        return res.status(403).json({
          success: false,
          message:
            "Team members do not have any availabilties set within this guild.",
        });
      }
      const availabilities = {
        id: availabilitySnapshot.docs[0].id,
        ...availabilitySnapshot.docs[0].data(),
      };

      const res = await fetch(
        `${API_URL}/availability/${guildId}/${availabilities.userId}/${availabilities.shortId}`,
        {
          method: "DELETE",
        }
      );
    }
    res
      .status(200)
      .json({ success: true, message: `Cleared ${team.teamName}'s schedule.` });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to clear schedule command" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
