(function() {
  'use strict';
  class signUpController {


    //end-non-standard

    constructor(Auth, $state, $scope, TrainRoutes, Schools) {
      this.Auth = Auth;
      this.$state = $state;
      this.modes = [];
      const schools = Schools.query().$promise;

      const trains = TrainRoutes.query().$promise;
      Promise.all([schools, trains]).then((data) => {
        this.schools = data[0];
        this.trainRoutes = data[1];
        console.log(this.trainRoutes);
        _.forEach(this.trainRoutes, line => {
          this.modes.push(line.mode);
        });
        this.modes = _.uniq(this.modes);
      });

      $scope.$watch("vm.selectLine", (oldValue, newValue) => {
        console.log("the old value is", oldValue);
        console.log("the new value is", newValue);
      })
    }

    register(form) {
      // this.submitted = true;
      // if (form.$valid) {
      //   this.Auth.createUser({
      //     name: this.user.name,
      //     email: this.user.email,
      //     password: this.user.password,
      //     school: this.user.school,
      //     studentId: this.user.userId
      //   })
      //     .then(() => {
      //       // Account created, redirect to home
      //       this.$state.go('main');
      //     })
      //     .catch(err => {
      //       err = err.data;
      //       this.errors = {};
      //
      //       // Update validity of form fields that match the mongoose errors
      //       angular.forEach(err.errors, (error, field) => {
      //         form[field].$setValidity('mongoose', false);
      //         this.errors[field] = error.message;
      //       });
      //     });
      // }
    }
  }
  angular.module('tTimeApp')
    .controller('signUpController', signUpController)
}());
