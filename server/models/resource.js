const mongoose = require("mongoose");

const ResourceSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: "project" },
  title: String,
  description: String,
  url: String,
  purpose: String,
  notes: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("resource", ResourceSchema);
