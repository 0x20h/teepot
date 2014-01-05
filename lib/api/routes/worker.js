var log = require('winston'),
		supervisor = require('../../supervisor.js')

module.exports = exports = function(app) {
	
	app.get('/worker', function(req, rsp) {
		var supervisor = app.get('supervisor')
		rsp.json(supervisor.getWorkers())
	})

	app.get('/worker/:pid', function(req, rsp) {
		var supervisor = app.get('supervisor')
		rsp.json(supervisor.getWorker(req.params.pid))
	})
}
