# Sendmail Facade

A sendmail compatible command which uses node code (nodemailer) to send email as a relay. 

## Installation

```
npm i -g sendmail-facade
```

Installs the command `sendmail-facade`. Can be sym linked as `sendmail`.


## Configuration

By default, it looks for `/etc/sendmail-facade/transports.json` for the smtp parameters to use.
These are keyed configurations where the key is the "from" name being used, `default` is
used if there's no match.


```
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
```

The transport element is the transport configuration from nodemailer. The default file
and directory can be created after the global package install by running
`sudo sendmail-facade-install-defaults`.
