// Copyright 2015 Teem2 LLC, MIT License (see LICENSE)
// Dreem server
require = require('./define') // support define.js modules

// load up math core and make it global
define.global(require('$base/math'))

if(process.argv.indexOf('-nomoni') != -1){
	define.atRequire = function(filename){
		process.stderr.write('\x0F' + filename + '\n', function(){})
	}
}

var fs = require('fs')
var path = require('path')

// ok now we can require components
var ansicolor = require('$debug/ansicolor')
console.color = ansicolor(function(v){
	process.stdout.write(v)
}) 

console.clear = function(){
	process.stdout.write("\033[2J");
}

console.setposition =function(x,y)
{
	process.stdout.write("\033["+y.toString() + ";"+x.toString() + "f");
}
// make a nice console.dump function
var dump = require('$core/debug/dump')
console.dump = function(){
	// lets grab where we are called
	console.log(new Error().stack)
	console.color(dump(Array.prototype.slice.apply(arguments), 1000000, dump.colors))
}

function main(){
	var argv = process.argv	
	var args = {}
	for(var lastkey = '', arg, i = 0; i<argv.length; i++){
		arg = argv[i]
		if(arg.charAt(0) == '-') lastkey = arg, args[lastkey] = true
		else args[lastkey] = arg
	}

	if(args['-web']){
		args['-edit'] = true
		args['-notify'] = true
		args['-devtools'] = true
		args['-delay'] = true
		args['-nodreem'] = true
		args['-browser'] = args['-web']
		args['-extlib'] = args['-extlib'] || "../projects"
	}

	if(args['-nomoni'] && args['-trace']){
		var trace = require('$core/debug/trace')
		define.atModule = function(module){
			module.exports = trace(module.exports, module.filename, args['-trace'])
		}
	}

	if(args['-h'] || args['-help'] || args['--h'] || args['--help']){
		console.color('~by~Teem~~ Server ~bm~2.0~~\n')
		console.color('commandline: node server.js <flags>\n')
		console.color('~bc~-web htmlfile.html~~ Short for -edit -notify -devtools -nodreem -delay -browser htmlfile.html\n')	
		console.color('~bc~-port ~br~[port]~~ Server port\n')
		console.color('~bc~-nomoni ~~ Start process without monitor\n')
		console.color('~bc~-iface ~br~[interface]~~ Server interface\n')
		console.color('~bc~-browser~~ Opens webbrowser on default app\n')
		console.color('~bc~-notify~~ Shows errors in system notification\n')
		console.color('~bc~-devtools~~ Automatically opens devtools in the browser\n')
		console.color('~bc~-close~~ Auto closes your tab when reloading the server\n')
		console.color('~bc~-delay~~ Delay reloads your pages when reloading the server\n')
		console.color('~bc~-nodreem~~ Ignore dreem.js changes for server reload\n')
		console.color('~bc~-restart~~ Auto restarts after crash (Handy for client dev, not server dev)\n')
		console.color('~bc~-edit~~ Automatically open an exception in your code editor at the right line\n')
		return process.exit(0)
	}
	define.$extlib = define.joinPath(define.$root, args['-extlib'] || '../projects')
	define.$rendermode = 'headless'

	try{fs.mkdirSync(define.expandVariables(define.$build))}catch(e){}

	if(args['-nomoni']){
		if(args['-sync']){
			var GitSync = require('$core/server/gitsync')
			
			new GitSync(args)
		}
		else
		if(args['-dali']){
			var DaliClient = require('$core/dreem/daliclient')
			new DaliClient(args)
		}
		else if(args['-test']){
			require('$core/acornserializer')
		}
		else{
			var TeemServer = require('$core/dreem/dreemserver')
			new TeemServer(args)
		}

	}
	else{
		var RunMonitor = require('$core/server/runmonitor')
		new RunMonitor(args)
	}
}

main()