var log = require('winston'),
		express = require('express'),
		http = require('http'),
		fs = require('fs'),
		app = express(),
		route_path = [__dirname, 'routes'].join('/') 

module.exports = app

app.use(function(req, rsp, next) {
	log.info(req.method, req.url)
	next()
})

/**
 * Overwrite the standard listen function to register routes lazy on listen.
 */
app.listen = function() {
	log.info('listening')

	fs.readdirSync(route_path).forEach(function(f) {
		var routes = [route_path, f].join('/')
		log.info('loading routes from ' + routes)
		require(routes)(app);
	})
	var server = http.createServer(this)
	return server.listen.apply(server, arguments)
};
