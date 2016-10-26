const assert = require('chai').assert;
const proxyquire = require('proxyquire');
const _ = require('lodash');

const mockResponse1 = {
  travel_times: [
    {
      route_id: "Green-D",
      direction: "1",
      dep_dt: "1477391500",
      arr_dt: "1477392400",
      travel_time_sec: "800",
      benchmark_travel_time_sec: "480",
      threshold_flag_1: "threshold_id_04"
    },
    {
      route_id: "Green-D",
      direction:"1",
      dep_dt: "1477394105",
      arr_dt: "1477394658",
      travel_time_sec: "553",
      benchmark_travel_time_sec: "480"
    }
  ]
};

const mockResponse2 = {
  travel_times: [
    {
      route_id: "Green-D",
      direction: "1",
      dep_dt: "1477394760",
      arr_dt: "1477395560",
      travel_time_sec: "800",
      benchmark_travel_time_sec: "480",
      threshold_flag_1: "threshold_id_04"
    },
    {
      route_id: "Green-D",
      direction:"1",
      dep_dt: "1457455105",
      arr_dt: "1457455658",
      travel_time_sec: "553",
      benchmark_travel_time_sec: "480"
    }
  ]
};

const mockResponse3 = {
  travel_times: [
    {
      route_id: "Green-D",
      direction: "1",
      dep_dt: "1457455760",
      arr_dt: "1457456560",
      travel_time_sec: "800",
      benchmark_travel_time_sec: "480",
      threshold_flag_1: "threshold_id_04"
    },
    {
      route_id: "Green-D",
      direction:"1",
      dep_dt: "1457456105",
      arr_dt: "1457456658",
      travel_time_sec: "553",
      benchmark_travel_time_sec: "480"
    }
  ]
};

const requestMock = function(url, callback) {
  let response;
  if (_.includes(url, "from_stop=635")) {
    response = mockResponse1;
  } else if (_.includes(url, "from_stop=70001")) {
    response = mockResponse2;
  } else {
    response = mockResponse3;
  }

  callback(null, {}, JSON.stringify(response));
}

const mongooseMock = {
  connect: function() {
    return { disconnect: _.noop };
  }
};

const mockUsers = [
  {
    name: "Roslindale Jack",
    journey_start_time: "6:30",
    stops: [
      { from_stop_id: 635, to_stop_id: 10642 },
      { from_stop_id: 70001, to_stop_id: 70011 },
      { from_stop_id: 17863, to_stop_id: 1488 }
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
  it('runs', (done) => {
    lateness.run().then((result) => {
      console.log('result', result);
      done();
    }, (error) => {
      console.error('error', error);
      assert.fail(error);
    });
  });

  it('will return the first train if the window ends before the first train leaves', (done) => {
    const stop = { from_stop_id: 635, to_stop_id: 2 };
    lateness.fetchLateness(stop, 1457453740, 1457453750).then((worstCaseArrival) => {
      assert.equal(worstCaseArrival, 1457754560);
      done();
    });
  });

  it('will return the second train if the window ends between trains', (done) => {
    const stop = { from_stop_id: 635, to_stop_id: 2 };
    lateness.fetchLateness(stop, 1457453750, 1457453790).then((worstCaseArrival) => {
      assert.equal(worstCaseArrival, 1457754658);
      done();
    });
  });
});
