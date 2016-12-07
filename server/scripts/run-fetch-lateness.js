const fetchLateness = require("./fetch-lateness").run;

fetchLateness().then((results) => {
  console.log(results);
}, (error) => {
  console.log(error);
});
