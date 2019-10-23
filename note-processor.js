const nodemailer = require('nodemailer')
const fs = require('fs')
const filog = require('filter-log')
let log = filog('sendmail-facade')


let processor = function(input) {

	// initialize the logging. This is done late so that default parameters can be changed.
	if(!processor.initialized) {
		processor.init()
	}

	let email = processor.createMessage(input)
	email = processor.processCommandLineArgs(email)

	let senderOptions = processor.loadSenderOptions(email)

	processor.sendEmail(email, senderOptions)

	return ''

}

processor.loggerName = 'standard'
processor.configurationPath = '/etc/sendmail-facade/transports.json'
processor.initialized = false


processor.createMessage = function(input) {
	// figure out where the headers end and the message begins
	let breakPoint = input.indexOf('\n\n')
	if(breakPoint < 0) {
		breakPoint = input.indexOf('\r\n\r\n')
	}
	if(breakPoint < 0) {
		breakPoint = input.indexOf('\n\r\n\r')
	}


	// parse out the headers
	let headers = input.substring(0, breakPoint).split('\n').map(line => line.trim()).reduce( (acc, line) => {
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

processor.processCommandLineArgs = function(email) {
	// check the command line for any parameters
	// most of these we want to ignore as they tell sendmail how to
	// process the message instead of what to send, but we don want to
	// pick up any "to" addresses passed as arguments.
	let commandLineTo = []
	if(process.argv.length > 2) {

		let args = process.argv.slice(2)
		for(let arg of args) {
			if(arg.indexOf('-') == 0) {
				continue
			}
			if(arg.indexOf('@') > -1) {
				commandLineTo.push(arg)
			}
		}
	}

	if(commandLineTo.length > 0) {
		if(email.to) {
			commandLineTo.push(email.to)
		}
		email.to = commandLineTo.join(', ')
	}

	return email
}


processor.loadSenderOptions = function(email) {
	let senderOptions = null

	// Look for the sender options in the configuration file
	// Ideally, we'd also provide a way from the command line to specify
	// an alternative configuration
	if(fs.existsSync(processor.configurationPath)) {
		try {
			let transports = JSON.parse(fs.readFileSync(processor.configurationPath));

			// use the option matching or our "from" header or the default transport if that doesn't exist
			senderOptions = transports[email.from] || transports.default
		}
		catch(e) {
			log.error(e)
		}
	}
	return senderOptions
}

processor.sendEmail = function(email, senderOptions) {
	// create the nodemailer transport
	let transport = nodemailer.createTransport(senderOptions.transport)

	// send it.
	transport.sendMail(email, function(error, info) {
		try {
			if (error) {
				// Error logging is configured by default to go to standard error
				log.error('Could not send email: %s\n%s', error.message, error.stack)
				log.error({
					message: 'Email lost',
					response: info.response,
					senderOptions: senderOptions,
					email: email
				})
			} else {
				// but info logging is configured by default to go nowhere
				log.info({
					message: 'Email sent',
					response: info.response,
					senderOptions: senderOptions,
					email: email
				})
			}
		} catch (e) {
			console.log(e)
		}
	})

}

processor.init = function() {
	if(!filog.logsProc[processor.loggerName]) {
		filog.defineProcessor(
			processor.loggerName,
			{}, 
			process.stderr, 
			function(entry) {
				return entry.level && entry.level >= filog.levels.ERROR
			}
		)
	}
	processor.initialized = true
}


module.exports = processor