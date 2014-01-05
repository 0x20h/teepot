var log = require('winston'),
		supervisor = require('../../supervisor.js')

module.exports = exports = function(app) {
	var supervisor = app.get('supervisor'),
			options = app.get('options')
	
	app.get('/channel', function(req, rsp) {
		rsp.json(supervisor.getWorkers())
	})

	app.get('/channel/:channel', function(req, rsp) {
		var workers = supervisor.getWorkers(req.params.channel)
		
		if (workers === undefined) {
			rsp.status(404)
		}

		rsp.json(workers)
	})

	app.get('/worker/:pid', function(req, rsp) {
		supervisor.getWorker(req.params.pid, function(worker) {
			if (worker === undefined) {
				rsp.status(404)
			}
			
			rsp.json(worker)
		})
	})
}
