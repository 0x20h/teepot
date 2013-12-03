var log = require('winston'),
		events = require('events')


observer.prototype.__proto__ = events.EventEmitter.prototype
module.exports = observer;

function observer(client, options) {
	if (!(this instanceof observer)) {
		return new observer(client, options)
	}

	events.EventEmitter.call(this)
	
	var self = this
	this.client = client
	this.options = options

	log.info('observing queue sizes for', Object.keys(options.channels))

	this.interval = setInterval(
		function() {
			self.check(Object.keys(options.channels))
		}, 
		options.observer.interval
	)
}

observer.prototype.stop = function() {
	throw new Error('not implemented')
}

observer.prototype.check = function(channels) {

	var multi = this.client.multi(),
			prefix = this.options.redis.prefix,
			self = this
	
	channels.forEach(function(channel) {
		multi.llen(prefix + channel)
	});

	multi.exec(function(err, reply) {
		if (err) {
			self.emit('error', err)
		} else {
			for (var i = 0; i < reply.length; i++) {
				self.emit(reply[i] > 0 ? 'busy' : 'idle', channels[i], reply[i])
			}
		}
	})

}
