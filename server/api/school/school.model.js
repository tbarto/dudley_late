'use strict';

import mongoose from 'mongoose';

var SchoolSchema = new mongoose.Schema({
  schoolName: String
});

export default mongoose.model('School', SchoolSchema);
