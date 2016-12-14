/**
 * Populate DB with sample data on server start
 * to disable, edit config/environment/index.js, and set `seedDB: false`
 */

'use strict';
import User from '../api/user/user.model';
import School from '../api/school/school.model'
import TrainRoute from '../api/trainRoutes/trainRoutes.model';
import _ from 'lodash';
import Promise from 'bluebird';
const request = Promise.promisifyAll(require('request'));
const config = require('./local.env');

User.find({}).remove()
  .then(() => {
    User.create({
      provider: 'local',
      name: 'Test User',
      email: 'test@example.com',
      password: 'test',
      school: 'school 1',
      studentId: 123
    }, {
      provider: 'local',
      role: 'admin',
      name: 'Admin',
      email: 'admin@example.com',
      password: 'admin',
      school: 'school 1'
    })
      .then(() => {
        console.log('finished populating users');
      });
  });

School.find({}).remove()
  .then(() => {
    School.create({
      schoolName: "Orchard Gardens"
    },
    {
      schoolName: "Jeremiah E. Burke"
    },
    {
      schoolName: "Dearborn"
    }
    )
  });


// Migration Script for Train Routes
let getTrainStops = function() {
  // Get all train routes
  return request.getAsync(config.mbtaEndpoint + "routes?api_key=" + config.apiKey + "&format=json")
    .then(data => {
      const trainModes = JSON.parse(data.body).mode;
      return trainModes;
    })
    .then(data => {
      let trainRoutes = [];
      _.forEach(data, dataItem => {
        let mode = dataItem.mode_name;
        _.forEach(dataItem.route, route => {
          trainRoutes.push({route: route.route_name, mode: mode, route_id: route.route_id});
        });
      });
      return trainRoutes
    })
    // Get all stops
    .then(trainRoutes => {
      let trainStops = [];
      _.forEach(trainRoutes, trainRoute => {
        trainStops.push(request.getAsync(config.mbtaEndpoint + "stopsbyroute?api_key=" + config.apiKey + `&route=${trainRoute.route_id}&format=json`)
          .then(data => {
            let trainStop = {
              route: trainRoute.route,
              mode: trainRoute.mode,
              route_id: trainRoute.route_id,
              stops: []
            };
            let stopBody = JSON.parse(data.body).direction;
            _.forEach(stopBody, direction => {
              _.forEach(direction.stop, stop => {
                let thisStop = {
                  directionId: direction.direction_id,
                  directionName: direction.direction_name,
                  stop_id: stop.stop_id,
                  stop_name: stop.stop_name
                };
                trainStop.stops.push(thisStop);
              });
            });
            return trainStop
          }));
      });
      return Promise.all(trainStops).then(function(data) {
        return data;
      });
    });
};

TrainRoute.find({}).remove()
  .then(() => {
    console.log("Adding train routes... this might take awhile");
    getTrainStops().then(data => {
      Promise.all(_.forEach(data, dataItem =>{
        TrainRoute.create({
          route: dataItem.route,
          mode: dataItem.mode,
          route_id: dataItem.route_id,
          stops: dataItem.stops
        });
      })).then(() => {
        console.log("Added all train routes");
      });
    });
  });
