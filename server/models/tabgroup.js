const mongoose = require("mongoose");

const TabLinkSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    url: String,
  },
  { _id: false }
);

const TabGroupSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: "project" },
  title: String,
  links: [TabLinkSchema],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("tabgroup", TabGroupSchema);
