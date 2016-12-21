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

  Run it like this on a cron:
  $ npm run fetch-lateness
*/

const _ = require('lodash');
const qs = require('qs');
const co = require('co');
const request = require('request');
const moment = require('moment');
const mongoose = require('mongoose');
const apiKey = require('../config/local.env').apiKey;
const config = require('../config/environment/development');
const User = require('../api/user/user.model').default;
const Episode = require('../api/episodes/episodes.model').default;
const db = mongoose.connect(config.mongo.uri, config.mongo.options);
require('babel-polyfill');

const defaultStationWalkingTime = 3 * 60;

// use the same broad time window to MBTA for better cacheing
const morningStart = new Date().setHours(5, 0, 0, 0);
const morningEnd = new Date().setHours(9, 0, 0, 0);

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
        return _.pick(user, ['name', 'school', 'stops', 'journey_start_time',
          'walk_to_school_minutes']);
      }));
    });
  });
}

//
// Steps 2-4: Hit the MBTA API to determine train delays
//
const urlRoot = 'http://realtime.mbta.com/developer/api/v2.1/traveltimes';
function fetchLateness(stop, fromDatetime, toDatetime, studentName) {
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

    const comments = [];
    const url = `${urlRoot}?${qs.stringify(query)}`;

    //
    // We hit the MBTA API for the whole morning (TODO: cache the result)
    // then we use our own logic to determine the exact window we care about
    //
    request(url, (err, response, body) => {
      const travelTimes = JSON.parse(body).travel_times;
      if (_.isEmpty(travelTimes)) {
        reject('Could not find any routes in time window');
      }

      const routesAfterWindow = _.filter(travelTimes, (route) => {
        const startTime = _.parseInt(route.dep_dt) * 1000;
        return startTime >= toDatetime;
      });
      const firstDepartureTimeAfterWindow = _.min(_.map(routesAfterWindow, (route) => {
        return _.parseInt(route.dep_dt * 1000);
      }));
      const formattedFirstDepartureTime = moment(firstDepartureTimeAfterWindow).format('h:mm');
      comments.push(`${studentName} might have taken the ${formattedFirstDepartureTime} ` +
        `from ${stop.from_stop_name}`);

      const applicableRoutes = _.filter(travelTimes, (route) => {
        const startTime = _.parseInt(route.dep_dt * 1000);
        return startTime >= fromDatetime && startTime <= firstDepartureTimeAfterWindow;
      });
      if (_.isEmpty(applicableRoutes)) {
        reject('Could not find any routes in time window');
        return;
      }
      const lastArrivalRoute = _.last(_.sortBy(applicableRoutes,
        (time) => _.parseInt(time.arr_dt))
      );
      if (lastArrivalRoute.dep_dt * 1000 !== firstDepartureTimeAfterWindow) {
        // corner case
        comments.push(`The ${moment(firstDepartureTimeAfterWindow).format('h:mm')} ` +
          `actually arrived after the ${moment(firstDepartureTimeAfterWindow).format('h:mm')} ` +
          'even though it left earlier, so we\'ll give the student the benefit of ' +
          'the doubt and assume that they took that one');
      }
      const formattedDepart = moment(lastArrivalRoute.dep_dt * 1000).format('h:mm');
      const formattedArrival = moment(lastArrivalRoute.arr_dt * 1000).format('h:mm');
      const lateness = _.parseInt(lastArrivalRoute.travel_time_sec) -
        _.parseInt(lastArrivalRoute.benchmark_travel_time_sec);
      const latenessMessage = lateness <= 0 ?
        'on time' :
        `${_.parseInt(lateness / 60)} minutes late`;
      comments.push(`The ${formattedDepart} from ${stop.from_stop_name} was ${latenessMessage} ` +
        `and arrived at ${formattedArrival}`);

      const lastArrival = _.max(_.map(applicableRoutes, (time) => _.parseInt(time.arr_dt)));
      const effectiveArrival = lastArrival + defaultStationWalkingTime;

      resolve({
        comments,
        arrival: effectiveArrival
      });
    });
  });
}

function run(dateString) {
  return new Promise((resolve, reject) => {
    co (function *() {
      let users = yield fetchUsers();
      // XXX start hack
      users = _.map(users, (user) => {
        return _.assign({}, user, {
          journey_start_time: "6:30",
          stops: [
            /*
            TODO
            {
              from_stop_id: 635,
              from_stop_name: "Washington St",
              to_stop_id: 10642,
              to_stop_name: "Andrew Square"
            }
            */
          ]
        });
      });
      // XXX end hack
      const arrivalTimes = [];
      for (const user of users) {
        const journeyStart = user.journey_start_time;
        const [journeyStartHours, journeyStartMinutes] = journeyStart.split(':');
        const date = dateString ? new Date(dateString) : new Date();
        const windowEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(),
          journeyStartHours, journeyStartMinutes, 0);
        let windowEndMillis = windowEnd.getTime();
        let windowStartMillis = windowEndMillis - (1000 * 60 * 30);
        let comments = [];
        for (const stop of user.stops) {
          const result =  yield fetchLateness(stop, windowStartMillis, windowEndMillis, user.name);
          windowEndMillis = result.arrival * 1000;
          comments = comments.concat(result.comments);
          windowStartMillis = windowEndMillis - (1000 * 60 * 30);
        }
        const arrivalTime = windowEndMillis
          + (user.walk_to_school_minutes * 60 * 1000)
          - (defaultStationWalkingTime * 1000);
        comments.push(`From there it's a ${user.walk_to_school_minutes} walk to school, ` +
          `so the estimated arrival time to school is ${moment(arrivalTime).format('h:mm')}.`);
        arrivalTimes.push({
          name: user.name,
          arrivalTime: new Date(/* FIXME arrivalTime */),
          comments: _.map(comments, (comment) => {
            return { text: comment };
          })
        });
      }
      yield Episode.create(arrivalTimes);
      db.disconnect();
      resolve(arrivalTimes);
    }).catch((error) => {
      db.disconnect();
      reject(error);
    });
  });
}

exports.defaultStationWalkingTime = defaultStationWalkingTime;
exports.fetchLateness = fetchLateness;
exports.run = run;
