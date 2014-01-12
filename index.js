var prg = require('commander'),
    fs = require('fs'),
    log = require('winston'),
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
log
  .remove(log.transports.Console)
  .add(log.transports.Console, { 
    level: prg.verbosity,
    colorize: true,
    timestamp: true
  })

var  teepot = require('./lib')
var supervisor = teepot.supervisor(config)
// set reference to supervisor
teepot.api.set('supervisor', supervisor)
teepot.api.set('config', config)
teepot.api.set('base_dir', __dirname)

supervisor.start()
teepot.api.listen(config.api.port)
