const nodemailer = require('nodemailer')
const fs = require('fs')
const filog = require('filter-log')
const through2 = require('through2')
const child_process = require('child_process')
const utf8 = require('utf8')
const quotedPrintable = require('quoted-printable');
const isSpam = require('./is-spam')

let log = filog('sendmail-facade')


let processor = function (input) {

	// initialize the logging. This is done late so that default parameters can be changed.
	if (!processor.initialized) {
		processor.init()
	}

	let email = processor.createMessage(input)
	email = processor.processCommandLineArgs(email)
	email = processor.endcodeDecode(email)

	let senderOptions = processor.loadSenderOptions(email)
	
	if(isSpam(email, senderOptions)) {
		// by default, to syslog
		log.info({
			message: 'Email dropped because it was suspected spam',
			from: email.from,
			to: email.to
		})
	}
	else {
		processor.sendEmail(email, senderOptions)
	}


	return ''

}

processor.loggerName = 'standard'
processor.configurationPath = '/etc/sendmail-facade/transports.json'
processor.initialized = false


processor.createMessage = function (input) {
	// figure out where the headers end and the message begins
	let breakPoint = input.indexOf('\n\n')
	if (breakPoint < 0) {
		breakPoint = input.indexOf('\r\n\r\n')
	}
	if (breakPoint < 0) {
		breakPoint = input.indexOf('\n\r\n\r')
	}


	// parse out the headers
	let headers = input.substring(0, breakPoint).split('\n').map(line => line.trim()).reduce((acc, line) => {
		let parts = line.split(':').map(part => part.trim())
		acc[parts[0].toLowerCase()] = parts[1]
		return acc
	}, {})

	let contents = input.substring(breakPoint).trim()

	// I guess let's just assume the message is html for now.
	let email = Object.assign({}, headers, {
		html: contents
	})

	return email
}

processor.processCommandLineArgs = function (email) {
	// check the command line for any parameters
	// most of these we want to ignore as they tell sendmail how to
	// process the message instead of what to send, but we don want to
	// pick up any "to" addresses passed as arguments.
	let commandLineTo = []
	if (process.argv.length > 2) {

		let args = process.argv.slice(2)
		for (let arg of args) {
			if (arg.indexOf('-') == 0) {
				continue
			}
			if (arg.indexOf('@') > -1) {
				commandLineTo.push(arg)
			}
		}
	}

	if (commandLineTo.length > 0) {
		if (email.to) {
			commandLineTo.push(email.to)
		}
		email.to = commandLineTo.join(', ')
	}

	return email
}

processor.endcodeDecode = function(email) {
	// Some senders will transfer encode the message before it gets to us.
	// Because of the way nodemailer sends things, they show up as literals, so
	// we'll need to decode them first.
	// https://www.w3.org/Protocols/rfc1341/5_Content-Transfer-Encoding.html
	// https://en.wikipedia.org/wiki/Quoted-printable
	// 
	if(email.html.indexOf('=0D') || email.html.indexOf('=0A') || email.html.indexOf('=3D') ) {
		email.html = utf8.decode(quotedPrintable.decode(email.html))
	}
	return email
}

processor.loadSenderOptions = function (email) {
	let senderOptions = null

	// Look for the sender options in the configuration file
	// Ideally, we'd also provide a way from the command line to specify
	// an alternative configuration
	if (fs.existsSync(processor.configurationPath)) {
		try {
			let transports = JSON.parse(fs.readFileSync(processor.configurationPath));

			// use the option matching or our "from" header or the default transport if that doesn't exist
			senderOptions = transports[email.from] || transports.default
		}
		catch (e) {
			log.error(e)
		}
	}
	return senderOptions
}

processor.sendEmail = function (email, senderOptions) {
	// create the nodemailer transport
	let transport = nodemailer.createTransport(senderOptions.transport)

	// send it.
	transport.sendMail(email, function (error, info) {
		try {
			if (error) {
				// Error logging is configured by default to go to standard error and syslog
				log.error('Could not send email: %s\n%s', error.message, error.stack)
				log.error({
					message: 'Email lost',
					errorReport: error,
					email: email
				})
			} else {
				// by default, to syslog
				log.info({
					message: 'Email sent',
					from: email.from,
					to: email.to
				})
			}
		} catch (e) {
			console.log(e)
		}
	})

}

processor.init = function () {
	if (!filog.logsProc[processor.loggerName]) {
		filog.defineProcessor(
			processor.loggerName,
			{},
			process.stderr,
			function (entry) {
				return entry.level && entry.level >= filog.levels.ERROR
			}
		)

		let syslog = through2((data, enc, cb) => {
			child_process.spawn('logger', [data.toString()])
			cb(null, null);
		});
		filog.defineProcessor(
			'syslog',
			{},
			syslog,
			function (entry) {
				return entry.level && entry.level >= filog.levels.INFO
			}
		)

	}
	processor.initialized = true
}


module.exports = processor