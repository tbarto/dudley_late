'use strict';

angular.module('tTimeApp.auth', ['tTimeApp.constants', 'tTimeApp.util', 'ngCookies', 'ui.router'])
  .config(function($httpProvider) {
    $httpProvider.interceptors.push('authInterceptor');
  });
