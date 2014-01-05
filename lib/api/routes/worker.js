var log = require('winston'),
		supervisor = require('../../supervisor.js')

module.exports = exports = function(app) {
	app.get('/stats', function(req, rsp) {
		var supervisor = app.get('supervisor')
		rsp.json({'workers': supervisor.workers()})
	})
}
