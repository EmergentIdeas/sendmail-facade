#! /usr/local/bin/node
const fs = require('fs')
const child_process = require('child_process')
let configFile = '/etc/sendmail-facade/transports.json'


if(!fs.existsSync(configFile)) {
	child_process.spawnSync('mkdir', ['-p', '/etc/sendmail-facade'])
	fs.writeFileSync(configFile, `
	{
		"default": {
		    "transport": {
		        "host": "smtp.domain.com",
		        "port": 587,
		        "secure": false, // true for 465, false for other ports
		        "auth": {
		            "user": "sender@domain.com",
		            "pass": "sender-password"
		        }
		    }
		}
	}
	`)
}