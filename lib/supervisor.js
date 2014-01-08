/**
 * This file is part of the teepot package.
 *
 * Copyright (c) 2014 Jan Kohlhof <kohj@informatik.uni-marburg.de>
 *
 * Permission is hereby granted, free of charge, to any person 
 * obtaining a copy of this software and associated documentation 
 * files (the "Software"), to deal in the Software without 
 * restriction, including without limitation the rights to use, 
 * copy, modify, merge, publish, distribute, sublicense, and/or 
 * sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included 
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS 
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS 
 * IN THE SOFTWARE.
 */

var	crypto = require('crypto'),
		redis = require('redis'),
		log = require('winston'),
		os = require('os'),
		events = require('events'),
		cp = require('child_process')

supervisor.prototype.__proto__ = events.EventEmitter.prototype

function supervisor(options) {
	if (!(this instanceof supervisor)) {
		return new supervisor(options)
	}

	events.EventEmitter.call(this)
	this.options = options
	// child processes indexed by id
	this.worker = {}
	// worker processes indexed by id
	this.channel_worker = {}
	this.state = 'init'

	this.client = redis.createClient(
		options.redis.port,
		options.redis.host
	)
	
	this.client.on('error', function(err) {
		log.error(err.message)
	})
}

/**
 * init redis client, signal handlers and start up workers.
 */
supervisor.prototype.start = function() {
	var self = this
	
	this.state = 'running'
	this.client.on('connect', function() {
		for(channel in self.options.channels) {
			for (var i = 0; i < self.options.channels[channel].max; i++) {
				self.spawn(channel);
			}
		}
	})

	// register signal handlers
	process.on('SIGINT', function() { self.shutdown() })
	process.on('SIGHUP', function() { self.restart() })
}


supervisor.prototype.shutdown = function() {
		var self = this,
				ids = Object.keys(this.worker)
		
		this.on('idle', function() {
			log.info('shutdown complete, exiting...')
			process.exit()
		})

		this.state = 'shutdown'
		log.info('waiting for workers to shutdown...')
		
		if (!ids.length) {
			log.info('no workers active')
			this.emit('idle')
		} else {
			ids.forEach(function(v) {
				self.signal(v, 'SIGINT')
			})
		}
	}


supervisor.prototype.restart = function() {
	log.debug('restarting workers')
}

/**
 * Spawn a new worker on the given channel.
 */
supervisor.prototype.spawn = function(channel, callback) {
	var self = this,
			options = this.options,
			worker = this.worker,
			channel_worker = this.channel_worker[channel],
			callback = callback || function() {}
	
	if (channel_worker === undefined) {
		this.channel_worker[channel] = channel_worker = []
	}

	if (channel_worker.length >= options.channels[channel].max) {
		log.warn('max workers reached for ' + channel)
		return callback()
	}

	// generate unique worker ID before starting
	crypto.randomBytes(8, function(ex, buf) {
		var id = buf.toString('hex'),
				worker_args = options.worker.args,
				worker_args = worker_args.concat(id),
				worker_args = worker_args.concat(channel)

		log.info('starting worker ' + id + ' on ' + channel)
		
		var child = cp.spawn(options.worker.command, worker_args, {
			detached: false
		});

		worker[id] = {
			process: child,
			id: id,
			error_log: '',
			channel: channel,
			started_at: Date.now()
		}

		channel_worker.push(id)
		self.emit('worker.start', worker)
		callback(id)

		child.stderr.on('data', function(data) {
			worker[id].error_log += data.toString()
		})

		child.stdout.on('data', function(data) {
			log.debug(data.toString().replace(/\n/,'. '))
		})

		child.on('exit', function(code, sig) {
			self.emit('worker.stop', [worker[id], code])

			switch (code) {
				case 0:
					log.debug(id + ' exited with code ' + code)
					break
				default:
					// @TODO reschedule failed task + publish results
					log.error(id + ' exited with code ' + code)
					log.debug(worker[id].error_log)
					//client.evalSHA(scripts['reschedule'], [child.worker_id], function(err, reply) {
					//})
			}

			delete worker[id]
			
			if (Object.keys(worker).length == 0) {
				self.emit('idle')
			}		
			
			if (self.state == 'shutdown') {
				return callback()
			}
			
			// only restart worker if it is still registered
			// e.g. wasn't signalled
			var idx = channel_worker.indexOf(id)

			if (idx != -1) {
				log.info('restarting worker ' + id)
				channel_worker.splice(idx, 1)
				// restarting worker
				self.spawn.call(self, channel)
			}
		}).on('error', function(e) {
			log.error(e)
			delete worker[id]

			if (Object.keys(worker).length == 0) {
				self.emit('idle')
			}		
		})
	})
}


supervisor.prototype.signal = function(id, signal) {
	var signal = signal || 'SIGTERM',
			worker = this.worker

	if (worker[id] === undefined) {
		log.warn('unknown id', id)
		return false
	}

	var channel_worker = this.channel_worker[worker[id].channel],
			idx = channel_worker.indexOf(id)

	// remove the worker from the channel_worker index
	// this will prevent the worker from being restarted
	if (idx != -1) {
		channel_worker.splice(idx, 1)
	}
	
	worker[id].process.kill(signal)
	return true
}

/**
 * get current workers per channels.
 *
 * @return workers.
 */
supervisor.prototype.getWorkers = function(channel) {
	return channel ? this.channel_worker[channel] : this.channel_worker
}

supervisor.prototype.getWorker = function(id, fn) {
	var worker = this.worker[id] || null,
			key = this.options.redis.prefix + 'worker.' + id

	if (!worker) {
		return fn()
	}

	this.client.hgetall(key, function(err, reply) {
		if (err) {
			log.error(err)
			fn()
		} else {
			fn({
				id: id,
				pid: worker.process.pid,
				host: os.hostname(),
				channel: worker.channel,
				started_at: worker.started_at,
				current_task: reply ? reply.current_task : null
			})
		}
	});
}

/**
 * get current channel sizes.
 *
 * @param channels to check
 * @param cb callback function with (channels, sizes) as param
 */
supervisor.prototype.size = function(channels, cb) {
	var multi = this.client.multi(),
			prefix = this.options.redis.prefix,
			self = this
	
	channels.forEach(function(v) {
		multi.llen(prefix + v)
	});

	multi.exec(function(err, reply) {
		if (err) {
			self.emit('error', err)
		} else {
			var c = {}
			channels.forEach(function(v, k) {
				c[v] = reply[k]	
			})
			cb(self, c)
		}
	})
}
module.exports = supervisor
