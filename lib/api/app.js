var log = require('winston'),
    express = require('express'),
    http = require('http'),
    fs = require('fs'),
    app = express()

module.exports = app

app.use(function(req, rsp, next) {
  log.info(req.method, req.url)
  next()
}).use(express.urlencoded())

/**
 * Overwrite the standard listen function to register routes lazy on listen.
 */
app.listen = function() {
  var config = app.get('config'),
      base_dir = app.get('base_dir'),
      // set standard route path
      route_paths = config.api.route_paths
  
  route_paths.forEach(function(path) {
    fs.readdirSync([base_dir, path].join('/')).forEach(function(f) {
      var routes = [base_dir, path, f].join('/')
      log.info('loading routes from ' + routes)
      require(routes)(app);
    })
  })
  
  var server = http.createServer(this)
  return server.listen.apply(server, arguments)
};
