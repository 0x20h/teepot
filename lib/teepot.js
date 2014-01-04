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
		events = require('events'),
		cp = require('child_process')

teepot.prototype.__proto__ = events.EventEmitter.prototype

function teepot(options) {
	if (!(this instanceof teepot)) {
		return new teepot(options)
	}

	events.EventEmitter.call(this)
	this.options = options
	// child processes indexed by pid
	this.worker = {}
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
 * Observe channels and start/stop workers.
 */
teepot.prototype.start = function() {
	var self = this,
			command = this.options.worker.command,
			args = this.options.worker.args
	
	this.state = 'running'
	this.client.on('connect', function() {
		for(channel in self.options.channels) {
			self.channel_worker[channel] = []
			for (var i = 0; i < self.options.channels[channel].max; i++) {
				self.spawn(command, args, channel);
			}
		}
	})

	// register signal handlers
	process.on('SIGINT', function() { self.shutdown() })
	process.on('SIGHUP', function() { self.restart() })
}


teepot.prototype.shutdown = function() {
		var self = this,
				pids = Object.keys(this.worker)

		this.state = 'shutdown'
		if (this.size_interval) {
			clearInterval(this.size_interval)
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

teepot.prototype.spawn = function(command, args, channel) {
	var self = this,
			options = this.options,
			worker = this.worker,
			channel_worker = this.channel_worker[channel]
	
	if (channel_worker.length >= options.channels[channel].max) {
		log.warn('max workers reached for ' + channel)
		return
	}

	// generate unique worker ID before starting
	crypto.randomBytes(8, function(ex, buf) {
		var id = buf.toString('hex'),
				worker_args = args,
				worker_args = worker_args.concat(id),
				worker_args = worker_args.concat(channel)

		log.info('starting worker ' + id + ' on ' + channel)
		
		var child = cp.spawn(command, worker_args, {
			detached: false
		});
		
		child.worker_id = id
		child.error_log = ''
		worker[child.pid] = child
		channel_worker.push(child.pid)
		self.emit('worker.start', child)

		child.stderr.on('data', function(data) {
			child.error_log += data.toString()
		})

		child.stdout.on('data', function(data) {
			log.debug(data.toString().replace(/\n/,'. '))
		})

		child.on('exit', function(code, sig) {
			self.emit('worker.stop', [child, code])
			delete worker[child.pid]
			channel_worker.splice(channel_worker.indexOf(child), 1)

			switch (code) {
				case 0:
					log.debug(child.worker_id + ' exited with code ' + code)
					break
				default:
					// @TODO reschedule failed task + publish results
					log.error(child.worker_id + ' exited with code ' + code)
					log.debug(child.error_log)
					//client.evalSHA(scripts['reschedule'], [child.worker_id], function(err, reply) {
					//})
			}

			if (Object.keys(worker).length == 0) {
				self.emit('idle')
			}		
			
			if (self.state == 'shutdown') {
				return
			}

			log.info('restarting worker ' + id)
			// restarting worker
			self.spawn.call(self, command, args, channel)
		}).on('error', function(e) {
			log.error(e)
			delete worker[child.pid]

			if (Object.keys(worker).length == 0) {
				self.emit('idle')
			}		
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
	//delete worker[pid]
}

/**
 * get current workers per channels.
 *
 * @return workers.
 */
teepot.prototype.workers = function(cb) {
	log.info(Object.keys(this.worker))
}

/**
 * get current channel sizes.
 *
 * @param channels to check
 * @param cb callback function with (channels, sizes) as param
 */

teepot.prototype.size = function(channels, cb) {
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
module.exports = teepot
