var log = require('winston'),
		supervisor = require('../../supervisor.js')

module.exports = exports = function(app) {
	var supervisor = app.get('supervisor')
	
	app.get('/channel/workers', function(req, rsp) {
		rsp.json(supervisor.getWorkers())
	})
}
