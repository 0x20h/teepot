module.exports = {
	redis: {
		port: 6379,
		host: 'localhost',
		prefix: 'app.'
	},
	worker: {
		command: '/home/kohlhof/dev/private/teeparty-php/bin/teeparty',
		args: [
			'teeparty:worker',
			'-c/home/kohlhof/dev/private/teeparty-php/config.yml.example'
		],
		logs: 'logs/worker.log',
		max: 2
	},
	channels: ['foo', 'bar', 'baz'],
	observer: {
		interval: 1000
	},
	lambda: 0.9
}
