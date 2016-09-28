const assert = require('chai').assert;
const proxyquire = require('proxyquire');
const _ = require('lodash');

const mockResponse = {
  travel_times: [
    {
      route_id: "Green-D",
      direction: "1",
      dep_dt: "1457453760",
      arr_dt: "1457454560",
      travel_time_sec: "800",
      benchmark_travel_time_sec: "480",
      threshold_flag_1: "threshold_id_04"
    },
    {
      route_id: "Green-D",
      direction:"1",
      dep_dt: "1457454105",
      arr_dt:"1457454658",
      travel_time_sec:"553",
      benchmark_travel_time_sec: "480"
    }
  ]
};


const requestMock = function(url, callback) {
  console.log("url is", url);
  callback(null, {}, JSON.stringify(mockResponse));
}

const mongooseMock = {
  connect: function() {
    return { disconnect: _.noop };
  }
};

const mockUsers = [
  {
    name: "John X",
    journey_start_time: "6:30",
    stops: [
      { from_stop_id: 70172, to_stop_id: 70182 },
      { walking_time_minutes: 10 },
      { from_stop_id: 70182, to_stop_id: 12345 }
    ]
  }
];

const userMock = {
  default: {
    find: function(query, callback) {
      callback(null, mockUsers);
    }
  }
}

const lateness = proxyquire('../server/scripts/fetch-lateness', {
  mongoose: mongooseMock,
  request: requestMock,
  '../api/user/user.model': userMock
});

describe('lateness algorithm', () => {
  it('has a run function', (done) => {
    assert.isFunction(lateness.run);
    lateness.run().then((result) => {
      console.log('result', result);
      done();
    }, (error) => {
      console.error('error', error);
      assert.fail(error);
    });
  });

  it('will return the first train if the window ends before the first train leaves', (done) => {
    const stop = { from_stop_id: 1, to_stop_id: 2 };
    lateness.fetchLateness(stop, 1457453740, 1457453750).then((worstCaseArrival) => {
      assert.equal(worstCaseArrival, 1457754560);
      done();
    });
  });

  it('will return the second train if the window ends between trains', (done) => {
    const stop = { from_stop_id: 1, to_stop_id: 2 };
    lateness.fetchLateness(stop, 1457453750, 1457453790).then((worstCaseArrival) => {
      assert.equal(worstCaseArrival, 1457754658);
      done();
    });
  });

});
