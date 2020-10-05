const redis = require('redis')
const client = new redis.createClient()

exports.set = function(key, value, ttl = 3600) {
	return new Promise((resolve, reject) => {
		client.set(key, value, (err, result) => {
			if (err) return reject(err)
			client.expire(key, ttl, (expireErr, expireRes) => {
				if (err) return reject(expireErr)

				resolve(expireRes)
			})
		})
	})
}

exports.setNoExpire = function(key, value) {
	return new Promise((resolve, reject) => {
		client.set(key, value, (err, result) => {
			if (err) return reject(err)

			resolve(result)
		})
	})
}

exports.hmset = function(key, value) {
	return new Promise((resolve, reject) => {
		client.hmset(key, value, (err, result) => {
			if (err) return reject(err)

			resolve(result)
		})
	})
}

exports.get = function(key) {
	return new Promise((resolve, reject) => {
		client.get(key, (err, result) => {
			if (err) return reject(err)

			resolve(result)
		})
	})
}

exports.hmget = function(key) {
	return new Promise((resolve, reject) => {
		client.hmget(key, (err, result) => {
			if (err) return reject(err)

			resolve(result)
		})
	})
}

exports.del = function(key) {
	return new Promise((resolve, reject) => {
		client.del(key, (err, result) => {
			if (err) return reject(err)

			resolve(result)
		})
	})
}

exports.getTTL = function(key, options = { formatDate: false, getEPOCH: false }) {
	return new Promise((resolve, reject) => {
		client.ttl(key, (err, result) => {
			if (err) return reject(err)

			if (result === -1) return resolve(-1)
			if (result < 0) return resolve(null)
			if (options.getEPOCH) return resolve(Date.now() + (result * 1000))
			if (options.formatDate) return resolve(exports.getShortDate(Date.now() + (result * 1000)))
			resolve(result)
		})
	})
}

exports.incr = function(key) {
	return new Promise((resolve, reject) => {
		client.incr(key, (err, result) => {
			if (err) return reject(err)

			resolve(result)
		})
	})
}

exports.flushAll = function() {
	return new Promise((resolve, reject) => {
		client.flushdb((err, result) => {
			if (err) return reject(err)
			resolve(result)
		})
	})
}

exports.flushStats = function() {
	exports.del('servers_joined')
	exports.del('servers_left')
	exports.del('shards_disconnected')
	exports.del('shards_resumed')
	exports.del('errors')
	exports.del('commands')
	exports.del('mysql_errors')
	exports.del('stats')

	exports.setNoExpire('stats_since', Date.now())
}

exports.getStats = function() {
	return new Promise((resolve, reject) => {
		client.info((err, result) => {
			if (err) return reject(err)
			resolve(result)
		})
	})
}

exports.getShortDate = function(date) {
	let convertedTime = new Date(date).toLocaleString('en-US', {
		timeZone: 'America/New_York'
	})
	convertedTime = new Date(convertedTime)

	const d = convertedTime
	const month = d.getMonth() + 1
	const day = d.getDate()
	const year = d.getFullYear()
	const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).replace(' ', '')

	return `${month}/${day}/${year.toString().slice(2)} ${time} EST`
}

client.on('connect', () => {
	console.log('[CACHE] Redis connected')
})

client.on('error', err => {
	console.error('[CACHE]')
	console.error(err)
})
