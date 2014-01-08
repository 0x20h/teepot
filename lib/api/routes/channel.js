var log = require('winston'),
		supervisor = require('../../supervisor.js')

module.exports = exports = function(app) {
	var supervisor = app.get('supervisor'),
			config = app.get('config')
	
	app.get('/channel/workers', function(req, rsp) {
		rsp.json(supervisor.getWorkers())
	})

	app.post('/channel/:channel', function(req, rsp) {
		var channel = req.params.channel,
				max = req.body.max
		
		if (max === undefined) {
			return rsp.status(400).send()
		}

		config.channels[channel].max = max
		rsp.json(config.channels[channel])
	})
}
