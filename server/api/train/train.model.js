'use strict';

import mongoose from 'mongoose';

var TrainSchema = new mongoose.Schema({
  name: String,
  info: String,
  active: Boolean
});

export default mongoose.model('Train', TrainSchema);
