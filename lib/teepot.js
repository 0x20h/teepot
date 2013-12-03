var	crypto = require('crypto'),
		redis = require('redis'),
		log = require('winston'),
		cp = require('child_process'),
		observer = require('./channel/observer')


function teepot(options) {
	if (!(this instanceof teepot)) {
		return new teepot(options)
	}

	this.options = options
	// object indexed by worker pid
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

				if (self.load > 0.5) {
					self.spawn(self.options.worker.command, self.options.worker.args)
				} else {
					var pids = Object.keys(self.worker)

					if (pids !== undefined && pids.length) {
						self.signal(pids[0])
					}
				}
			}

	this.client.on('connect', function() {
		this.observer = observer(self.client, self.options)
			.on('busy', update_load)
			.on('idle', update_load)
			.on('error', function(err) {
				log.error(err.message)
			})
		log.info('ready')
	})
}


teepot.prototype.spawn = function(command, args) {
	var options = this.options,
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

		log.debug('starting worker ' + id)
		
		var child = cp.spawn(command, args, {
			stdio: [0,1,2]
		});

		child.worker_id = id
		worker[child.pid] = child

		child.on('exit', function(code, sig) {
			if (code != 0) {
				log.error(child.worker_id + ' exited with code ' + code)
			}

			delete worker[child.pid]
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
}

teepot.prototype.workers = function() {
	log.info(Object.keys(this.worker))
}

module.exports = teepot
