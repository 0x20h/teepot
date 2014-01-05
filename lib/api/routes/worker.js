var log = require('winston'),
		supervisor = require('../../supervisor.js')

module.exports = exports = function(app) {
	var supervisor = app.get('supervisor')
	
	app.get('/worker', function(req, rsp) {
		rsp.json(supervisor.getWorkers())
	})

	app.get('/worker/:pid', function(req, rsp) {
		rsp.json(supervisor.getWorker(req.params.pid))
	})
}
