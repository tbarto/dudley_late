'use strict';

(function() {

  class MainController {

    constructor() {

    }
  }

  angular.module('tTimeApp')
    .component('main', {
      templateUrl: 'app/main/main.html',
      controller: MainController,
      controllerAs: 'vm'
    });
})();
