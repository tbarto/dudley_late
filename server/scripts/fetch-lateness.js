/**

  Required inputs:
  1. For each student a list of their routes (an array of from-stop to-stop pairs)
  2. For each student a journey start time that's been verified by a human as
    being reasonable given their commute.
  3. For each possible final destination to the school, a hard-stop time representing
    the latest a student can arrive and still get to school on time.
  4. MBTA API that returns timing of trains/busses on routes given from-stop, to-stop,
    and time range.

  Algorithm as follows:
  1. Look in the user collection to see their routes and their journey start time
  Then for each user...
  2. Looks at the first leg, with a window 30 minutes before the journey start time
    up to the journey start time
  3. Pings MBTA (possibly cache-ing responses to avoid over-pinging)
  4. Determines the worst-case arrival at their first transfer station
  5. Looks at the second leg, with a window 30 minutes before the worst-case
    arrival time to 5 minutes after (to account for the walk across the station)
  6. Pings MBTA to determine the worst-case arrival time for that leg
  7. Repeat for all legs to determine the worst-case arrival time to the destination station
  8. Compares the worst-case arrival time to the hard-stop time for that station
    to determine the lateness in minutes that the student is entitled to
  9. Persists the results back into another mongo collection

  TODO: actually implement this algorithm

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
    journey_start_time: "6:30",
    stops: [
      { from_stop_id: 70172, to_stop_id: 70182 },
      { walking_time_minutes: 10 },
      { from_stop_id: 70182, to_stop_id: 12345 }
    ]
  }
];

const mockDestinations = [
  { stop_id: 12345, hard_stop_time: "7:50" },
  { stop_id: 12347, hard_stop_time: "7:54" }
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
