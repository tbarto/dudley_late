'use strict';
const config = require('../local.env');
// Development specific configuration
// ==================================
module.exports = {

  // MongoDB connection options
  mongo: {
    uri: config.mongoDev
  },

  // Seed database on startup
  seedDB: false

};
