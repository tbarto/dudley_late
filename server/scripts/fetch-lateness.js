const _ = require("lodash");
const qs = require("qs");
const request = require("request");
const apiKey = require("../config/local.env").apiKey;

const urlRoot = "http://realtime.mbta.com/developer/api/v2.1/traveltimes";
function fetchLateness(fromStop, toStop, fromDatetime, toDatetime) {
  return new Promise((resolve, reject) => {
    const query = {
      api_key: apiKey,
      format: "json",
      from_stop: fromStop,
      to_stop: toStop,
      from_datetime: fromDatetime,
      to_datetime: toDatetime
    };

    const url = urlRoot + "?" + qs.stringify(query);
    request(url, (err, response, body) => {
      const travelTimes = JSON.parse(body).travel_times;
      if (_.isEmpty(travelTimes)) {
        // XXX or maybe it's ok if there were no routes returned
        reject("No travel times found");
      }

      const travelTime = _.first(travelTimes); // XXX randomly picking the first
      const lateness = _.parseInt(travelTime.travel_time_sec) -
        _.parseInt(travelTime.benchmark_travel_time_sec);
      resolve({ fromStop, toStop, lateness });
    });
  });
}

fetchLateness(70172, 70182, 1457454139, 1457455262).then((result) => {
  console.log("result is", result);
}, (error) => {
  console.error(error);
});
