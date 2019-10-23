#! /usr/local/bin/node
var processor = require('./note-processor')
var transformer = require('console-in-transformer')
transformer.ignoreArguments = true
transformer(processor, '')