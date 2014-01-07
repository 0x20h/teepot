var log = require('winston'),
		supervisor = require('../../supervisor.js')

module.exports = exports = function(app) {
	var supervisor = app.get('supervisor'),
			config = app.get('config')

	app.get('/workers/(:channel)?', function(req, rsp) {
		var workers = supervisor.getWorkers(req.params.channel)
		
		if (workers === undefined) {
			rsp.status(404)
		}

		rsp.json(workers)
	})

	app.get('/worker/:id', function(req, rsp) {
		supervisor.getWorker(req.params.id, function(worker) {
			if (worker === undefined) {
				rsp.status(404)
			}
			
			rsp.json(worker)
		})
	})

	app.post('/worker/start', function(req, rsp) {
		var opts = config.worker,
				channel = req.body.channel

		if (config.channels[channel] === undefined) {
			return rsp.status(404).send()
		}
		
		supervisor.spawn(req.body.channel, function(id) {
			if (!id) {
				return rsp.status(409).json(
					{'msg': 'max workers reached for ' + req.body.channel}
				)
			}
			rsp.json(id)
		})
	})

	app.post('/worker/stop', function(req, rsp) {
		var id = req.body.id
		rsp.json(supervisor.signal(id, 'SIGTERM'))
	})
}
