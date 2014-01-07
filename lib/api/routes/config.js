var log = require('winston')

module.exports = exports = function(app) {
	var config = app.get('config')
	
	app.get('/config/(*)?', function(req, rsp) {
		var path = req.url,
				c = config
		
		if (path) {
			var p =	path.split(/\//)
			
			for (var i = 2; i < p.length; i++) {
				if (!c[p[i]]) {
					return rsp.status(404).send()
				}
				
				c = c[p[i]]
			}
		}
		
		rsp.json(c)
	})
	
	app.post('/config/(*)?', function(req, rsp) {
		var path = req.url,
				value = req.body
				c = config
		
		if (path) {
			var p =	path.split(/\//)
			
			for (var i = 2; i < p.length; i++) {
				if (!c[p[i]]) {
					return rsp.status(404).send()
				}
				
				c = c[p[i]]
			}

			c = value
		}
		
		rsp.json(c)
	})
}
