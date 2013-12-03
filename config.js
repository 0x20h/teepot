module.exports = {
	redis: {
		port: 6379,
		host: 'localhost',
		prefix: 'teeparty.'
	},
	worker: {
		command: '/home/kohlhof/dev/private/teeparty-php/bin/teeparty',
		args: [
			'teeparty:worker',
			'/home/kohlhof/dev/private/teeparty-php/config.yml.example',
		],
		logs: 'logs/worker.log'
	},
	channels: {
		foo: {
			worker: 3,
		},
		bar: {
			worker: 16,
		},
		baz: {
			worker: 2,
		}
	},
	observer: {
		interval: 1000
	},
	lambda: 0.8
}
