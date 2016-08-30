/**
 * Using Rails-like standard naming convention for endpoints.
 * GET     /api/Trains              ->  index
 * POST    /api/Trains              ->  create
 * GET     /api/Trains/:id          ->  show
 * PUT     /api/Trains/:id          ->  update
 * DELETE  /api/Trains/:id          ->  destroy
 */

'use strict';

import _ from 'lodash';
import Train from './train.model';
var request = require('request');
var config = require('../../config/local.env');

// var trackStart = 70202;
// var trackStop = 70153;
// var startTime = 1469322776;
// var stopTime = 1469495576;
// console.log(config.mbtaEndpoint + config.apiKey + `&format=json&from_stop=${trackStart}&to_stop=${trackStop}&from_datetime=${startTime}&to_datetime=${stopTime}`);
// request.get(config.mbtaEndpoint + config.apiKey + `&format=json&from_stop=${trackStart}&to_stop=${trackStop}&from_datetime=${startTime}&to_datetime=${stopTime}`, function(err,resp){
//   console.log(JSON.parse(resp.body).travel_times[0]);
// });
// var today = new Date();
// console.log(today.getDate(), today.getMonth()+1, today.getFullYear());

// Runs everyday to get the UTC times for
// function getUtcTimes(day):
function respondWithResult(res, statusCode) {
  statusCode = statusCode || 200;
  return function(entity) {
    if (entity) {
      res.status(statusCode).json(entity);
    }
  };
}

function saveUpdates(updates) {
  return function(entity) {
    var updated = _.merge(entity, updates);
    return updated.save()
      .then(updated => {
        return updated;
      });
  };
}

function removeEntity(res) {
  return function(entity) {
    if (entity) {
      return entity.remove()
        .then(() => {
          res.status(204).end();
        });
    }
  };
}

function handleEntityNotFound(res) {
  return function(entity) {
    if (!entity) {
      res.status(404).end();
      return null;
    }
    return entity;
  };
}

function handleError(res, statusCode) {
  statusCode = statusCode || 500;
  return function(err) {
    res.status(statusCode).send(err);
  };
}

// Gets a list of Trains
export function index(req, res) {
  return Train.find().exec()
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Gets a single Train from the DB
export function show(req, res) {
  return Train.findById(req.params.id).exec()
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Creates a new Train in the DB
export function create(req, res) {
  return Train.create(req.body)
    .then(respondWithResult(res, 201))
    .catch(handleError(res));
}

// Updates an existing Train in the DB
export function update(req, res) {
  if (req.body._id) {
    delete req.body._id;
  }
  return Train.findById(req.params.id).exec()
    .then(handleEntityNotFound(res))
    .then(saveUpdates(req.body))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Deletes a Train from the DB
export function destroy(req, res) {
  return Train.findById(req.params.id).exec()
    .then(handleEntityNotFound(res))
    .then(removeEntity(res))
    .catch(handleError(res));
}
