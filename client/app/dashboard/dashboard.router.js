'use strict';

angular.module('tTimeApp')
  .config(function($stateProvider) {
    $stateProvider.state('dashboard', {
      url: '/dashboard',
      templateUrl: 'app/dashboard/dashboard.html',
      controller: 'vm',
      controllerAs: 'dashboard',
      //authenticate: 'dashboard'
    });
  });
