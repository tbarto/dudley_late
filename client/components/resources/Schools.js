'use strict';

angular.module("tTimeApp")
  .factory('Schools', $resource => {
    return $resource('api/schools/:id', {id: '@id'}, {});
  });
