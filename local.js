
/* Run as local funtcion */

require('./lambda').handler({}, {}, (error) => {
  process.exit(error ? 1 : 0);
});