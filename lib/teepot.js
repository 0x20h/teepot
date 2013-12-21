var	crypto = require('crypto'),
		redis = require('redis'),
		log = require('winston'),
		events = require('events'),
		cp = require('child_process'),
		observer = require('./channel/observer')


teepot.prototype.__proto__ = events.EventEmitter.prototype

function teepot(options) {
	if (!(this instanceof teepot)) {
		return new teepot(options)
	}

	events.EventEmitter.call(this)
	this.options = options
	// child processes indexed by pid
	this.worker = {}
	// moving average on channel size growth
	this.load = 0
	this.last_size = 0

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
			update_load = function(size) {
				self.load = 
					self.options.lambda * self.load + 
					(1 - self.options.lambda) * size 

				log.debug({load: self.load, size: size})

				if (size > 0) {
					for (
							var i = Object.keys(self.worker).length; 
							i < Math.min(size, self.options.worker.max);
							i++) {

						self.spawn(self.options.worker.command, self.options.worker.args)
					}
				} else if (self.load < 0.5) {
					var pids = Object.keys(self.worker)

					if (pids !== undefined && pids.length) {
						self.signal(pids[0])
					}
				}
			}

	this.client.on('connect', function() {
		self.observer = observer(self.client, self.options)
			.on('busy', update_load)
			.on('idle', update_load)
			.on('error', function(err) {
				log.error(err.message)
			})
		log.info('ready')
	})

	// register signal handlers
	process.on('SIGINT', function() { self.shutdown() })
	process.on('SIGHUP', function() { self.restart() })
}


teepot.prototype.shutdown = function() {
		var self = this,
				pids = Object.keys(this.worker)

		if (this.observer) {
			this.observer.stop()
		}

		if (pids === undefined || !pids.length) {
			process.exit()
		}

		log.info('waiting for workers to shutdown...')
		
		pids.forEach(function(v) {
			self.signal(v, 'SIGINT')
		})

		self.on('idle', function() {
			log.info('shutdown complete, exiting...')
			process.exit()
		})
}

teepot.prototype.restart = function() {
	log.debug('restarting workers')
}

teepot.prototype.spawn = function(command, args) {
	var self = this,
			options = this.options,
			worker = this.worker,
			active_workers = Object.keys(worker).length
	
	if (active_workers >= options.worker.max) {
		return
	}

	// generate unique worker ID before starting
	crypto.randomBytes(8, function(ex, buf) {
		var id = buf.toString('hex')
				args = args.concat(id),
				args = args.concat(options.channels),

		log.info('starting worker ' + id)
		
		var child = cp.spawn(command, args, {
			detached: false
		});
		
		self.emit('busy')

		child.worker_id = id
		child.error_log = ''
		worker[child.pid] = child

		child.stderr.on('data', function(data) {
			child.error_log += data.toString()
		})

		child.stdout.on('data', function(data) {
			log.debug(data.toString().replace(/\n/,'. '))
		})

		child.on('exit', function(code, sig) {
			delete worker[child.pid]

			if (Object.keys(worker).length == 0) {
				self.emit('idle')
			}	
			
			switch (code) {
			case 0:
				log.debug(child.worker_id + ' exited with code ' + code)
				break
			default:
				// reschedule task
				log.error(child.worker_id + ' exited with code ' + code)
				log.debug(child.error_log)
				//client.evalSHA(scripts['reschedule'], [child.worker_id], function(err, reply) {
				//})
			}
		}).on('error', function(e) {
			log.error(e)
			delete worker[child.pid]
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
	delete worker[pid]
}


teepot.prototype.workers = function() {
	log.info(Object.keys(this.worker))
}

module.exports = teepot
