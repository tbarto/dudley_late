const assert = require('chai').assert;
const proxyquire = require('proxyquire');
const _ = require('lodash');

// all times are 11/15/2016
const mockResponse1 = {
  travel_times: [
    {
      route_id: 'Green-D',
      direction: '1',
      dep_dt: '1479211200', // 7:00 am
      arr_dt: '1479212000',
      travel_time_sec: '800',
      benchmark_travel_time_sec: '480',
      threshold_flag_1: 'threshold_id_04'
    },
    {
      route_id: 'Green-D',
      direction:'1',
      dep_dt: '1479211800', // 7:10 am
      arr_dt: '1479212353',
      travel_time_sec: '553',
      benchmark_travel_time_sec: '480'
    }
  ]
};

const mockResponse2 = {
  travel_times: [
    {
      route_id: 'Green-D',
      direction: '1',
      dep_dt: '1479211740', // 7:09 am
      arr_dt: '1479212540',
      travel_time_sec: '800',
      benchmark_travel_time_sec: '480',
      threshold_flag_1: 'threshold_id_04'
    },
    {
      route_id: 'Green-D',
      direction:'1',
      dep_dt: '1479212220', // 7:17 am
      arr_dt: '1479212773',
      travel_time_sec: '553',
      benchmark_travel_time_sec: '480'
    }
  ]
};

const mockResponse3 = {
  travel_times: [
    {
      route_id: 'Green-D',
      direction: '1',
      dep_dt: '1479212400', // 7:20 am
      arr_dt: '1479213200',
      travel_time_sec: '800',
      benchmark_travel_time_sec: '480',
      threshold_flag_1: 'threshold_id_04'
    },
    {
      route_id: 'Green-D',
      direction:'1',
      dep_dt: '1479213000', // 7:30 am
      arr_dt: '1479213553',
      travel_time_sec: '553',
      benchmark_travel_time_sec: '480'
    }
  ]
};

const requestMock = function(url, callback) {
  let response;
  if (_.includes(url, 'from_stop=635')) {
    response = mockResponse1;
  } else if (_.includes(url, 'from_stop=70001')) {
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
    name: 'Roslindale Jack',
    journey_start_time: '6:30',
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
    lateness.run('2016-11-15').then((result) => {
      assert.equal(result[0].name, 'Roslindale Jack');
      assert.equal(result[0].arrivalTime, 1479513200);
      console.log(result[0].comments);
      done();
    }, (error) => {
      console.error('error', error);
      assert.fail(error);
    });
  });

  it('will return the first train if the window ends before the first train leaves', (done) => {
    const stop = { from_stop_id: 635, to_stop_id: 2 };
    lateness.fetchLateness(stop, 1457453740000, 1479211100000).then((worstCase) => {
      assert.equal(worstCase.arrival, 1479212000 + lateness.defaultStationWalkingTime);
      done();
    });
  });

  it('will return the second train if the window ends between trains', (done) => {
    const stop = { from_stop_id: 635, to_stop_id: 2 };
    lateness.fetchLateness(stop, 1457453750000, 1479211300000).then((worstCase) => {
      assert.equal(worstCase.arrival, 1479212353 + lateness.defaultStationWalkingTime);
      done();
    });
  });
});
