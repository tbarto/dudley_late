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
    arrival time to *the first train that arrives after*
    5 minutes after (to account for the walk across the station)
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
const User = require('../api/user/user.model').default;
const db = mongoose.connect(config.mongo.uri, config.mongo.options);
require("babel-polyfill");

const defaultStationWalkingTime = 5 * 60 * 1000;

const mockDestinations = [
  { stop_id: 12345, hard_stop_time: "7:50" },
  { stop_id: 12347, hard_stop_time: "7:54" }
];

// use the same broad time window to MBTA for better cacheing
const morningStart = new Date().setHours(5, 0, 0, 0) / 1000;
const morningEnd = new Date().setHours(9, 0, 0, 0) / 1000;

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
        return _.pick(user, ['name', 'school', 'stops', 'journey_start_time']);
      }));
    });
  });
}

//
// Step 3: Hit the MBTA API to determine train delays
//
const urlRoot = 'http://realtime.mbta.com/developer/api/v2.1/traveltimes';
function fetchLateness(stop, fromDatetime, toDatetime) {
  return new Promise((resolve, reject) => {
    if (stop.walking_time_minutes) {
      resolve(toDatetime + (stop.walking_time_minutes * 60 * 1000));
      return;
    }

    const query = {
      api_key: apiKey,
      format: 'json',
      from_stop: stop.from_stop_id,
      to_stop: stop.to_stop_id,
      from_datetime: morningStart,
      to_datetime: morningEnd
    };

    // TODO: look in the cache

    const url = `${urlRoot}?${qs.stringify(query)}`;
    // TODO: query a larger window that we're going to look at,
    // and we have to consider the first train that arrives more than
    // 5 minutes after the worst-case time
    request(url, (err, response, body) => {
      const travelTimes = JSON.parse(body).travel_times;
      if (_.isEmpty(travelTimes)) {
        // XXX uhoh
        reject('No travel times found');
      }
      // TODO: add to the cache

      const routesAfterWindow = _.filter(travelTimes, (route) => {
        const startTime = _.parseInt(route.dep_dt);
        return startTime >= toDatetime;
      });
      const firstArrivalTimeAfterWindow = _.min(_.map(routesAfterWindow, (route) => {
        return _.parseInt(route.dep_dt);
      }));
      const applicableRoutes = _.filter(travelTimes, (route) => {
        const startTime = _.parseInt(route.dep_dt);
        return startTime >= fromDatetime && startTime <= firstArrivalTimeAfterWindow;
      });
      const lastArrival = _.max(_.map(applicableRoutes, (time) => _.parseInt(time.arr_dt)));
      resolve(lastArrival + defaultStationWalkingTime);
    });
  });
}

function run() {
  return new Promise((resolve, reject) => {
    co (function *() {
      const users = yield fetchUsers();
      const arrivalTimes = [];
      for (const user of users) {
        const journeyStart = user.journey_start_time;
        const [journeyStartHours, journeyStartMinutes] = journeyStart.split(":");
        let windowEndMillis = new Date().setHours(journeyStartHours, journeyStartMinutes, 0, 0);
        let windowStartMillis = windowEndMillis - (1000 * 60 * 30);
        for (const stop of user.stops) {
          windowEndMillis = yield fetchLateness(stop, windowStartMillis, windowEndMillis);
          windowStartMillis = windowEndMillis - (1000 * 60 * 30);
        }
        arrivalTimes.push({ name: user.name, arrivalTime: windowEndMillis });
      }
      db.disconnect();
      resolve(arrivalTimes);
    }).catch((error) => {
      console.error("error", error);
      db.disconnect();
      reject(error);
    });
  });
}

exports.fetchLateness = fetchLateness;
exports.run = run;
