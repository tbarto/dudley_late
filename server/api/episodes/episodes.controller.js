/**
 * Using Rails-like standard naming convention for endpoints.
 * GET     /api/TrainRoutes         ->  index
 * POST    /api/TrainRoutes         ->  create
 * GET     /api/TrainRoutes/:id     ->  show
 * PUT     /api/TrainRoutes/:id     ->  update
 * DELETE  /api/TrainRoutes/:id     ->  destroy
 */

'use strict';

import _ from 'lodash';
import Episode from './episodes.model';

function respondWithResult(res, statusCode) {
  statusCode = statusCode || 200;
  return function(entity) {
    if (entity) {
      res.status(statusCode).json(entity);
    }
  };
}

function handleError(res, statusCode) {
  statusCode = statusCode || 500;
  return function(err) {
    res.status(statusCode).send(err);
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

// Gets a list of Episodes
export function index(req, res) {
  return Episode.find().lean().exec()
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Gets a single Train from the DB
export function show(req, res) {
  return Episode.findById(req.params.id).exec()
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res));
}
