var prg = require('commander'),
		fs = require('fs'),
		winston = require('winston'),
		teepot = require('./lib/teepot')

prg
	.version('0.0.1')
	.option('-c, --config [FILE]', 'configuration file', './config.js')
	.option('--host [HOST]', 'Redis server')
	.option('--port [N]', 'Redis port')
	.option('--worker [N]', 'number of workers to start')
	.option('--command [CMD]', 'path to the script that starts workers')
	.parse(process.argv)


try {
	var config = require(prg.config)
} catch (e) {
	console.error("unable to load configuation from " + prg.config)
	process.exit(1)
}

// log config
winston
	.remove(winston.transports.Console)
	.add(winston.transports.Console, { 
		level: 'debug',
		colorize: true,
		timestamp: true
	})

teepot(config).start()
