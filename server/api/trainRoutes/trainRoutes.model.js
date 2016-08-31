'use strict';

import mongoose from 'mongoose';
const StopSchema = new mongoose.Schema({
  directionId: Number,
  directionName: String,
  stop_id: String,
  stop_name: String
});
var TrainSchema = new mongoose.Schema({
  route: String,
  mode: String,
  route_id: String,
  stops: [StopSchema]
});

export default mongoose.model('TrainRoute', TrainSchema);
