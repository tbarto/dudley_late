'use strict';

import mongoose from 'mongoose';
const EpisodeCommentSchema = new mongoose.Schema({
  text: String
});

const EpisodeSchema = new mongoose.Schema({
  name: String,
  arrivalTime: Date,
  comments: [EpisodeCommentSchema]
});

export default mongoose.model('Episode', EpisodeSchema);
