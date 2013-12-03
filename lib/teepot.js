var	crypto = require('crypto'),
		redis = require('redis'),
		log = require('winston'),
		cp = require('child_process'),
		observer = require('./observer')


function teepot(options) {
	if (!(this instanceof teepot)) {
		return new teepot(options)
	}

	this.options = options
	// object indexed by worker pid
	this.worker = {}
	// object indexed by channel with worker pids per channel
	this.channels = {}
	// moving average on channel size growth
	this.load = {}
	this.last_size = {}

	this.client = redis.createClient(
		options.redis.port,
		options.redis.host
	)
	
	this.client.on('error', function(err) {
		log.error(err.message)
	})
}

/**
 * Observe channels and start/stop workers.
 */
teepot.prototype.start = function() {
	var self = this,
			update_load = function(channel, size) {
				if (self.load[channel] === undefined) {
					self.load[channel] = 0
					self.last_size[channel] = 0
				}

				self.load[channel] = 
					self.options.lambda * self.load[channel] + 
					(1 - self.options.lambda) * size 

				if (self.load[channel] > 0.5) {
					log.debug(Math.ceil(Math.min(self.load[channel], self.options.channels[channel].worker)))
					self.spawn(channel, self.options.worker.command, self.options.worker.args)
				} else {
					var pids = self.channels[channel]

					if (pids !== undefined && pids.length) {
						self.signal(pids[0])
					}
				}
			}
	this.client.on('connect', function() {
		this.observer = observer(this.client, this.options)
			.on('busy', update_load)
			.on('idle', update_load)
			.on('error', function(err) {
				log.error(err.message)
			})
		log.info('ready')
	})
}


teepot.prototype.spawn = function(channel, command, args) {
	var options = this.options,
			worker = this.worker,
			channels = this.channels,
			active_workers = 0
	
	if (channels[channel] !== undefined) {
		active_workers = channels[channel].length
	}

	if (active_workers >= options.channels[channel].worker) {
		return
	}

	// generate unique worker ID before starting
	crypto.randomBytes(8, function(ex, buf) {
		var id = buf.toString('hex')
				args = args.concat(id),

		log.debug('starting worker ' + id + ' on channel ' + channel)

		var child = cp.spawn(command, args, {
			stdio: [0,'ignore',2]
		});

		child.worker_id = id
		worker[child.pid] = child

		if (channels[channel] === undefined) {
			channels[channel] = []
		}

		channels[channel].push(child.pid)

		child.on('exit', function(code, sig) {
			log.debug(child.worker_id + ' exited with code ' + code)
			delete worker[child.pid]
			channels[channel].splice(channels[channel].indexOf(child.pid), 1)
		}).on('error', function(e) {
			log.error(e)
			delete worker[child.pid]
			channels[channel].splice(channels[channel].indexOf(child.pid), 1)
		})
	})
}


teepot.prototype.signal = function(pid, signal) {
	var signal = signal || 'SIGTERM',
			worker = this.worker

	if (worker[pid] === undefined) {
		log.warn('unknown pid', pid)
		return
	}

	worker[pid].kill(signal)
}

teepot.prototype.workers = function() {
	log.info(Object.keys(this.worker))
}

module.exports = teepot
