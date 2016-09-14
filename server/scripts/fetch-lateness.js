/**

  This script does the following:
  1. Looks in your user collection to see the from-stops and to-stops
  2. Calculates an array of distinct from-stop to-stop pairs
  3. Hits the MBTA API for each of these pairs to determine train delays
  4. Persists the results back into another mongo collection TBD TODO

  Run it like this on a cron:
  $ npm run fetch-lateness
*/

const _ = require('lodash');
const qs = require('qs');
const co = require('co');
const request = require('request');
const mongoose = require('mongoose');
const apiKey = require('../config/local.env').apiKey;
const config = require('../config/environment/development');
import User from '../api/user/user.model';
const db = mongoose.connect(config.mongo.uri, config.mongo.options);

const mockUsers = [
  {
    stops: [{ stop_id: 70172 }, { stop_id: 70182 }]
  },
  {
    stops: [{ stop_id: 70172 }, { stop_id: 70182 }]
  }
];

//
// Step 1: Fetch users
//
function fetchUsers() {
  return new Promise((resolve, reject) => {
    User.find({}, (err, users) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(_.map(users, (user) => {
        return _.pick(user, ['name', 'school', 'stops']);
      }));
    });
  });
}

//
// Step 2: Calculate distinct routes
//
function calculateDistinctRoutes(users) {
  const routes = _.map(users, (user) => {
    return {
      fromStop: user.stops[0].stop_id,
      toStop: user.stops[1].stop_id
    };
  });

  return _.uniqBy(routes, ["fromStop", "toStop"]);
}

//
// Step 3: Hit the MBTA API to determine train delays
//
const urlRoot = 'http://realtime.mbta.com/developer/api/v2.1/traveltimes';
function fetchLateness(fromStop, toStop, fromDatetime, toDatetime) {
  return new Promise((resolve, reject) => {
    const query = {
      api_key: apiKey,
      format: 'json',
      from_stop: fromStop,
      to_stop: toStop,
      from_datetime: fromDatetime,
      to_datetime: toDatetime
    };

    const url = `${urlRoot}?${qs.stringify(query)}`;
    request(url, (err, response, body) => {
      const travelTimes = JSON.parse(body).travel_times;
      if (_.isEmpty(travelTimes)) {
        // XXX or maybe it's ok if there were no routes returned
        reject('No travel times found');
      }

      const latenesses = _.map(travelTimes, (travelTime) => {
        return _.parseInt(travelTime.travel_time_sec) -
          _.parseInt(travelTime.benchmark_travel_time_sec);
      });

      // give student benefit of the doubt and assign them the
      // most-delayed train in the date range
      resolve({ fromStop, toStop, lateness: _.max(latenesses) });
    });
  });
}

//
// Step 4: Persist the results back to mongo
//
function persistDelays(delays) {
  return new Promise((resolve, reject) => {
    // TODO: need a delays collection
    console.log("TODO: persist delays", delays);
    resolve();
  });
}

function run() {
  co (function *() {
    const startTime = 1457454139; // TODO: calculate this
    const endTime = 1457455262; // TODO: calculate this
    let users = yield fetchUsers();
    users = mockUsers; // XXX surprise!
    const routes = calculateDistinctRoutes(users);
    const delays = yield _.map(routes, (route) => {
      return fetchLateness(route.fromStop, route.toStop, startTime, endTime);
    });
    yield persistDelays(delays);
    db.disconnect();
    console.log("ok done");
  }).catch((error) => {
    console.error(error);
    db.disconnect();
  });
}

run();
