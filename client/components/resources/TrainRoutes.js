'use strict';

angular.module("tTimeApp")
  .factory('TrainRoutes', $resource => {
    return $resource('api/TrainRoutes/:id', {id: '@id'}, {});
  });
