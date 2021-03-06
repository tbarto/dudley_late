'use strict';

angular.module('tTimeApp', ['tTimeApp.auth', 'tTimeApp.admin', 'tTimeApp.constants', 'ngCookies',
    'ngResource', 'ngSanitize', 'ui.router', 'ui.bootstrap', 'validation.match'
  ])
  .config(function($urlRouterProvider, $locationProvider) {
    $urlRouterProvider.otherwise('/');

    $locationProvider.html5Mode(true);
  });
