'use strict';

class SignupController {
  //end-non-standard

  constructor(Auth, $state, $http) {
      this.Auth = Auth;
      this.$state = $state;
      this.$http = $http;
      this.stopData = [];
      // ToDo this needs to be set a collection
      this.schools = ['School 1', 'School 2', 'School 3'];
    }
    //start-non-standard

  $onInit() {
    this.$http.get('/api/things')
      .then(response => {
        this.awesomeThings = response.data;
      });
  }

  register(form) {
    this.submitted = true;
    if (form.$valid) {
      this.Auth.createUser({
          name: this.user.name,
          email: this.user.email,
          password: this.user.password,
          school: this.user.school,
          studentId: this.user.userId
        })
        .then(() => {
          // Account created, redirect to home
          this.$state.go('main');
        })
        .catch(err => {
          err = err.data;
          this.errors = {};

          // Update validity of form fields that match the mongoose errors
          angular.forEach(err.errors, (error, field) => {
            form[field].$setValidity('mongoose', false);
            this.errors[field] = error.message;
          });
        });
    }
  }
}

angular.module('tTimeApp')
  .controller('SignupController', SignupController);
