var log = require('winston'),
		express = require('express'),
		fs = require('fs'),
		app = express(),
		route_path = [__dirname, 'routes'].join('/') 

module.exports = app

app.use(function(req, rsp, next) {
	log.info(req.method, req.url)
	next()
})

fs.readdirSync(route_path).forEach(function(f) {
	var routes = [route_path, f].join('/')
	log.info('loading routes from ' + routes)
	require(routes)(app);
})

