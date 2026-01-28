const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema({
  creator: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  title: String,
  description: String,
  reminders: { type: [mongoose.Schema.Types.Mixed], default: [] },
  resources: [{ type: mongoose.Schema.Types.ObjectId, ref: "resource" }],
  tabGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: "tabgroup" }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("project", ProjectSchema);
