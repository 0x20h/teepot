var prg = require('commander'),
		fs = require('fs'),
		winston = require('winston'),
		teepot = require('./lib'),
		path = require('path')

prg
	.version('0.0.1')
	.option('-c, --config [FILE]', 'configuration file', 
			[__dirname, 'config.js'].join('/'))
	.option('--host [HOST]', 'Redis server')
	.option('--port [N]', 'Redis port')
	.option('--worker [N]', 'number of workers to start')
	.option('--command [CMD]', 'path to the script that starts workers')
	.option('-v, --verbosity [LEVEL]', 'error, info, debug', 'info')
	.parse(process.argv)

var configfile = path.resolve(prg.config)
try {
	var config = require(configfile)
} catch (e) {
	console.error("unable to load configuation from " + configfile)
	process.exit(1)
}

// log config
winston
	.remove(winston.transports.Console)
	.add(winston.transports.Console, { 
		level: prg.verbosity || 'info',
		colorize: true,
		timestamp: true
	})

teepot.supervisor(config).start()
