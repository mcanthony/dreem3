// Copyright 2015 Teem2 LLC, MIT License (see LICENSE)
// Micro AMD module loader for browser and node.js and basic system homogenisation library

(function define_module(config_define){

	// the main define function
	function define(factory){
		if(arguments.length == 2){ // precompiled version
			define.factory[arguments[1]] = factory
			return
		}
		define.last_factory = factory // store for the script tag
		// continue calling
		if(define.define) define.define(factory)
	}

	// default config variables
	define.inner = define_module
	define.$root = ''

	define.$classes = "$root/classes"
	define.$core = "$root/core"
	define.$lib = "$root/lib"
	define.$build = "$root/build"
	define.$compositions = "$root/compositions"
	define.$tests = '$root/tests'
	define.$fonts = '$root/fonts'	
	define.$textures = "$root/textures"

	// directory structure variables
	define.$base = '$core/base'
	define.$async = '$core/async'
	define.$debug = '$core/debug'
	define.$dreem = '$core/dreem'
	define.$gl = '$core/gl'
	define.$parsers = '$core/parsers'
	define.$renderer = '$core/renderer'
	define.$rpc = '$core/rpc'
	define.$server = '$core/server'
	define.$animation = '$core/animation'

	// copy configuration onto define
	if(typeof config_define == 'object') for(var key in config_define){
		define[key] = config_define[key]
	}

	define.fileName = function(file){
		file = file.replace(/\\/g,'/')
		var file = file.slice(define.filePath(file).length)
		if(file.charAt(0) == '/') return file.slice(1)
		return file
	}

	define.filePath = function(file){
		if(!file) return ''
		file = file.replace(/\.\//g, '')
		var m = file.match(/([\s\S]*)\/[^\/]*$/)
		return m ? m[1] : ''
	}

	define.fileExt = function(file){
		// parse from the last . to end
		var m = file.match(/\.([^.\/]+)($|\?)/)
		if(!m) return ''
		return m[1]
	}

	define.cleanPath = function(path){
		return path.replace(/^\/+/,'/').replace(/([^:])\/+/g,'$1/')
	}

	define.joinPath = function(base, relative){
		if(relative.charAt(0) != '.'){ // relative is already absolute
			if(relative.charAt(0) == '/' || relative.indexOf(':') != -1){
				return relative
			}
			var path = base + '/' + relative
			return define.cleanPath(path)
		}
		base = base.split(/\//)
		relative = relative.replace(/\.\.\//g,function(){ base.pop(); return ''}).replace(/\.\//g, '')
		return define.cleanPath(base.join('/') + '/' + relative)
	}

	// expand define variables
	define.expandVariables = function(str){
		return define.cleanPath(str.replace(/(\$[a-zA-Z]+[a-zA-Z0-9]*)/g, function(all, lut){
			if(!(lut in define)) throw new Error("Cannot find " + lut + " used in require")
			return define.expandVariables(define[lut])
		}))
	}

	define.findRequires = function(str){
		var req = []
		// bail out if we redefine require
		if(str.match(/function\s+require/) || str.match(/var\s+require/)){
			return req
		}
		str.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').replace(/require\s*\(\s*["']([^"']+)["']\s*\)/g, function(m, path){
			req.push(path)
		})
		return req
	}

	define.localRequire = function(base_path, from_file){
		function require(dep_path){
			abs_path = define.joinPath(base_path, define.expandVariables(dep_path))
			if(!define.fileExt(abs_path)) abs_path = abs_path + '.js'

			// lets look it up
			var module = define.module[abs_path]
			if(module) return module.exports

			// otherwise lets initialize the module
			var factory = define.factory[abs_path]
			module = {exports:{}, factory:factory, id:abs_path, filename:abs_path}
			define.module[abs_path] = module

			if(factory === null) return null // its not an AMD module, but accept that
			if(!factory) throw new Error("Cannot find factory for module (file not found):" + abs_path)

			// call the factory
			if(typeof factory == 'function'){
				var ret = factory.call(module.exports, define.localRequire(define.filePath(abs_path), abs_path), module.exports, module)
				if(ret !== undefined) module.exports = ret
			}
			else module.exports = factory
			// post process hook
			if(define.atModule) define.atModule(module)

			return module.exports
		}

		require.async = function(path){
			var dep_path = define.joinPath(base_path, define.expandVariables(path))
			return new Promise(function(resolve, reject){
				if(define.factory[path]){
					// if its already asynchronously loading.. 
					var module = require(path)
					return resolve(module)
				}
				define.loadAsync(dep_path, from_file).then(function(){
					var module = require(path)
					resolve(module)
				}, reject)
			})
		}

		return require
	}

	define.profile = function(times, cb){
		var bs = Date.now()
		for(var i = 0; i < times; i++) cb(i)
		var delta = (Date.now() - bs)
		console.log("Profile " + delta + "ms for " + times + '(' + (delta/times)+')')
	}

	define.binding = function(fn){
		fn.isBinding = true
		return fn
	}

	define.debug = true

	// lamo hash. why doesnt js have a really good one built in hmm?
	define.cheapHash = function(str){
		if(typeof str !== 'string') return 0
		var hash = 5381,
		i = str.length
		while(i) hash = (hash * 33) ^ str.charCodeAt(--i)
		return hash >>> 0
	}

	define.builtinClassArgs = {
		exports:1, module:2, require:3, self:4, proto:4, constructor:1, base:5
	}

	define.applyBody = function(body, Constructor, base, require){
		if(typeof body == 'object' && body){
			for(var key in body) Constructor.prototype[key] = body[key]
			return
		}
		if(typeof body !== 'function') return

		// named arguments for the class body
		var argmap = body.argmap
		if(!argmap) argmap = body.argmap = define.buildArgMap(body)

		// allright lets go figure out our body arguments.
		var args = []
		for(var i = 0; i < argmap.length; i++){
			var arg = argmap[i]
			var builtin = define.builtinClassArgs[arg]
			if(builtin){
				if(builtin === 1) args[i] = Constructor
				else if(builtin === 2) args[i] = Constructor.module
				else if(builtin === 3){
					if(!require) throw new Error('You cant get require on the class body as argument here')
					args[i] = require
				}
				else if(builtin === 4) args[i] = Constructor.prototype
				else if(builtin === 5) args[i] = base
			}
			else{
				if(!require) throw new Error('Can only use fast-require classes on a file-class')
				args[i] = require(define.atLookupClass(arg))
			}
		}

		Object.defineProperty(Constructor, 'bodyhash', {value:define.cheapHash(body.toString())})

		return body.apply(Constructor.prototype, args)
	}

	define.EnvironmentStub = function(dep){ this.dep = dep }

	define.makeClass = function(base, body, require, module){

		var stubbed
		if(body && body.environment !== undefined && body.environment !== define.$environment){
			// turn require into a no-op internally
			require = function(dep){ return new define.EnvironmentStub(dep) }
			require.async = function(dep){ return new Promise(function(res, rej){res(null)})}
			stubbed = true
		}

		function MyConstructor(){
			// if called without new, just do a new
			var obj = this
			if(!(obj instanceof MyConstructor)){
				obj = Object.create(MyConstructor.prototype)
				Object.defineProperty(obj, 'constructor', {value:MyConstructor})
			}

			// instance all nested classes
			var nested = MyConstructor.nested
			if(nested) for(var name in nested){
				var nest = obj[name.toLowerCase()] = new nested[name]()
				Object.defineProperty(nest, 'parent', {value:obj})
			}

			// call atConstructor if defined
			if(obj._atConstructor) obj._atConstructor.apply(obj, arguments)
			if(obj.atConstructor) obj.atConstructor.apply(obj, arguments)
			return obj
		}
		
		if(define.debug){
			var fnname
			if(module){
				fnname = define.fileName(module.filename).replace(/\.js/g,'').replace(/\./g,'_').replace(/\//g,'_')
			}
			else{
				// lets make an fnname based on our callstack
				var origin = new Error().stack.split(/\n/)[3].match(/\/([a-zA-Z0-9\.]+)\:(\d+)\:\d+\)/)
				if(!origin || origin[1] === 'define.js'){
					fnname = 'extend'
					if(base && base.prototype.constructor) fnname += '_' + base.prototype.constructor.name
				}
				else fnname = origin[1].replace(/\.js/g,'').replace(/\./g,'_').replace(/\//g,'_') + '_' + origin[2]
			}
			var code = 'return ' + MyConstructor.toString().replace(/MyConstructor/g, fnname)
			var Constructor = new Function(code)()
		}
		else{
			var Constructor = MyConstructor
		}		

		var final_at_extend = Array.isArray(body)? body: []

		if(base){
			Constructor.prototype = Object.create(base.prototype)
			Object.defineProperty(Constructor.prototype, 'constructor', {value:Constructor})
			if(base.nested){
				var nested = Object.create(base.nested)
				Object.defineProperty(Constructor, 'nested', {value:nested})
				for(var name in nested){
					// lets inherit from the baseclass
					var cls = nested[name] = nested[name].extend(final_at_extend)
					Object.defineProperty(Constructor.prototype, name.toLowerCase(), {value:cls.prototype, writable:true})
					Object.defineProperty(Constructor, name, {value:cls, writable:true})
				}
			}
		}

		Object.defineProperty(Constructor, 'extend', {value:function(body){
			return define.makeClass(this, body, require)
		}})

		Object.defineProperty(Constructor, 'overlay', {value:function(body){
			return define.applyBody(body, this, base)
		}})

		if(stubbed) Object.defineProperty(Constructor, 'stubbed', {value:true})

		Object.defineProperty(Constructor, 'nest', {value:function(name, cls){
			if(!Constructor.nested) Object.defineProperty(Constructor, 'nested', {value:cls})
			Constructor.nested[name] = cls
			Object.defineProperty(Constructor.prototype, name.toLowerCase(), {value: cls.prototype, writable:true})
			Object.defineProperty(Constructor, name, {value:cls, writable:true})
		}})

		if(Array.isArray(body)){
			if(Constructor.prototype.atExtend) body.push(Constructor.prototype)
		}
		else{
			if(module){
				module.exports = Constructor
				Object.defineProperty(Constructor, 'module', {value:module})
				define.applyBody(body, Constructor, base, require)
			}
			else{
				define.applyBody(body, Constructor, base)
			}

			if(Constructor.prototype.atExtend) Constructor.prototype.atExtend()

			// call atExtend on nested classes so outer class bodies can apply properties on nested classes
			if(final_at_extend.length){
				for(var i = 0; i < final_at_extend.length; i++){
					final_at_extend[i].atExtend()
				}
			}
		}

		return Constructor
	}

	define.buildArgMap = function(fn){
		var map = fn.toString().match(/function\s*[\w]*\s*\(([\w,\s]*)\)/)[1].split(/\s*,\s*/)
		for(var i = 0; i<map.length; i++) map[i] = map[i].toLowerCase()
		return map
	}
	
	define.local_classes = {}

	define.atLookupClass = function(cls, basepath){
		var luc = define.local_classes[cls]
		if(luc !== undefined) return luc
		return '$classes/' + cls
	}

	// defining a class as environment specific
	define.browser = function(body, body2){
		if(typeof body2 === 'function') body = body2
		body.environment = 'browser'
		define.class.apply(define, arguments)
	}

	define.nodejs = function(body, body2){
		if(typeof body2 === 'function') body = body2
		body.environment = 'nodejs'
		define.class.apply(define, arguments)
	}

	// a class which just defines the render function
	define.render = function(render){
		// we need to define a class where the body is the render function.
		function body(){
			this.render = render.bind.apply(render, arguments)
		}
		var argmap = body.argmap = define.buildArgMap(render)
		// validate args
		for(var i = 0; i < argmap.length; i++){
			var arg = argmap[i]
			if(arg in define.builtinClassArgs) throw new Error('Cannot use builtin arg ' + arg + ' in render class, use a normal class please')
		}
		define.class(body)
	}

	// class module support
	define.class = function(){
		// lets make a class
		var base_class
		var body
		if(typeof arguments[0] === 'string'){ // class with baseclass
			base_class = arguments[0]
			body = arguments[1]
		}
		else{
			body = arguments[0]
		}

		function moduleFactory(require, exports, module){
			define.makeClass(base_class? require(base_class): null, body, require, module)
		}

		// make an argmap
		body.argmap = define.buildArgMap(body)
	
		// lets parse the named argument pattern for the body
		moduleFactory.body = body
		// put the baseclass on the deps
		if(base_class) moduleFactory.deps = 'require("' + base_class + '")'

		// add automatic requires
		if(body.argmap){
			for(var i = 0; i <body.argmap.length; i++){
				var arg = body.argmap[i]
				if(!(arg in define.builtinClassArgs)){
					var luttedclass = define.atLookupClass(arg)
					moduleFactory.deps += 'require("' + luttedclass + '")'
					// the first non builtin argument is the baseclass if we dont have one
					if(!base_class) base_class = luttedclass
				}
			}
		}

		if(typeof arguments[arguments.length - 1] == 'string'){ // packaged
			define(moduleFactory, arguments[arguments.length - 1])
		}
		else{ // unpackaged
			define(moduleFactory)
		}
	}
	
	define.struct = function(def, id){

		function getStructArrayType(type){
			var def = type.def
			if(def.prim) return type
			var tt, mt
			for(var key in def)if(typeof def[key] !== 'string'){
				mt = getStructArrayType(def[key])
				if(mt !== tt){
					if(tt=== undefined) tt = mt
					else return null // mixed type
				}
				else tt = mt
			}
			return tt
		}

		function getStructSize(def){
			if(def.prim) return 1
			var size = 0
			for(var key in def) if(typeof def[key] !== 'string') size += getStructSize(def[key].def)
			return size
		}

		function structInit(out, outoff, inp, inpoff, depth){
			for(var i = inpoff, len = inp.length; i < len; i++){
				var item = inp[i]
				if(typeof item == 'number') out[outoff++] = item
				else outoff = structInit(out, outoff, item, 0, depth++)
			}
			if(depth === 0 && outoff !== mysize) throw new Error('Cannot initialize '+Struct.id+' with '+outoff+'parameters')
			return outoff
		}

		var myprim = getStructArrayType({def:def})
		var myarray = myprim?myprim.def.array:null
		var mysize = getStructSize(def)
		var Struct
		if(def.prim){
			if(myarray === Float32Array || myarray === Float64Array){
				Struct = function FloatLike(value){
					if(value && value.isArray) return value
					return parseFloat(value)
				}
			}
			else{
				if(id === 'bool'){
					Struct = function BoolLike(value){
						if(value && value.isArray) return value
						return value? true: false
					}
				}
				else{
					Struct = function IntLike(value){
						if(value && value.isArray) return value
						return parseInt(value)
					}
				}
			}
			Struct.bytes = def.bytes
			Struct.primitive = true
		}
		else{
			function MyStruct(){
				var out = new myarray(mysize), len = arguments.length
				out.struct = MyStruct
				if(len === 0) return out
				var arg0 = arguments[0]
				if(len === 1 && typeof arg0 !== 'string'){
					if(arg0 && arg0.isArray) return arg0
					if(typeof arg0 === 'number'){ // copy struct
						for(var i = 0; i < mysize; i++) out[i] = arg0
						return out
					}
					// treat as array
					if(arg0.struct || Array.isArray(arg0)){
						for(var i = 0; i < mysize; i++) out[i] = arg0[i]
						return out
					}
					throw new Error("TODO implement object constructing for types")
				}
				if(len === mysize){
					for(var i = 0; i < len; i++) out[i] = arguments[i]
					return out
				}
				if(typeof arg0 === 'string'){
					MyStruct.fromString.apply(out, arguments)
					return out
				}
				structInit(out, 0, arguments, 0, 0)
				return out
			}
			if(define.debug && id){ // give the thing a name we can read
				var fnname = id
				var code = 'return '+MyStruct.toString().replace(/MyStruct/g,fnname)
				Struct = new Function('myarray','mysize', code)(myarray, mysize)
			}
			else{
				Struct = MyStruct
			}
			if(myprim) Struct.bytes = mysize * myprim.bytes
		}

		Struct.slots = mysize
		Struct.struct = Struct
		Struct.def = def
		Struct.primary = myprim

		Struct.copy = function(src, o){
			if(!o){
				o = new myarray(src.buffer.slice(0))
				o.struct = Struct
				return o
			}
			for(var i = 0; i < o.length; i++){
				o[i] = src[i]
			}
		}


		Struct.keyInfo = function(key){
			var type = this.def[key]
			if(typeof type === 'string') type = this.def[type]
			// ok lets compute the offset of type
			var offset = 0
			for(var ikey in this.def){
				if(ikey == key) break
				var itype = this.def[ikey]
				offset += itype.bytes
			}
			return {offset:offset, type:type}
		}

		Struct.keyType = function(key){
			// look it up normally
			var type = this.def[key]
			if(typeof type === 'string') return this.def[type]
			if(type !== undefined) return type
			// parse swizzled vector and gl types
			var i = 0, ch, l = key.length
			if(l <= 1 && l > 4) return

			if(mysize === 2){
				while(i < l){ // xy
					ch = key.charCodeAt(i++)
					if(ch !== 120 && ch !== 121){i = 0;break}
				}
				while(i < l){ // rg
					ch = key.charCodeAt(i++)
					if(ch !== 114 && ch !== 103){i = 0;break}
				}
				while(i < l){ // st
					ch = key.charCodeAt(i++)
					if(ch !== 115 && ch !== 116){i = 0;break}
				}
			}
			else if(mysize === 3){ 
				while(i < l){ // xyz
					ch = key.charCodeAt(i++)
					if(ch !== 120 && ch !== 121 && ch !== 122) {i = 0;break}
				}
				while(i < l){ // rgb
					ch = key.charCodeAt(i++)
					if(ch !== 114 && ch !== 103 && ch !== 98) {i = 0;break}
				}
				while(i < l){ // stp
					ch = key.charCodeAt(i++)
					if(ch !== 115 && ch !== 116 && ch !== 112) {i = 0;break}
				}
			}
			else if(mysize === 4){
				while(i < l){ // xyzw
					ch = key.charCodeAt(i++)
					if(ch !== 120 && ch !== 121 && ch !== 122 && ch !== 119){i = 0;break}
				}
				while(i < l){ // rgba
					ch = key.charCodeAt(i++)
					if(ch !== 114 && ch !== 103 && ch !== 98 && ch !== 97){i = 0;break}
				}
				while(i < l){ // stpq
					ch = key.charCodeAt(i++)
					if(ch !== 115 && ch !== 116 && ch !== 112 && ch !== 113){i = 0;break}
				}				
			}
			if(i == l){
				var swiz = define.typemap.swizzle[myprim.def.type]
				if(!swiz) return
				return swiz[l]
			}
		}			

		if(id !== undefined) Struct.id = id

		Struct.chunked = function(chunk_size){
			var obj = Object.create(this.chunked_type)
			obj.constructor = this
		}

		Struct.array = function(length){
			if(!length) length = 0
			var init_array
			if(typeof length == 'object'){// constructor
				if(!Array.isArray(length)) throw new Error('Can only initialize arrays with arrays')
				init_array = length
				length = init_array.length
				if(typeof init_array[0] == 'number') length /= mysize
			}

			// fixed size wrapper
			var obj = Object.create(this.array_type)
			obj.constructor = Struct
			obj.arrayconstructor = myarray
			obj.array = new myarray(mysize * length)
			obj.length = 0
			obj.allocated = length
			obj.slots = mysize
			obj.stride = mysize * myprim.bytes
			obj.struct = this

			if(init_array){
				if(typeof init_array[0] == 'number'){
					for(var i = 0; i < init_array.length; i++) obj.array[i] = init_array[i]
					obj.length = length
				}
				else length = parseInt(structInit(this.array, 0, init_array, 0, 1) / mysize)
			}
			return obj
		}

		Struct.quad = function(){
			if(arguments.length == 1) return this.array( arguments[0] * 6)
			var array = this.array(6)
			array.pushQuad.apply(array, arguments)
			return array
		}

		Struct.array_type  = Object.create(define.struct.array_type)
		Struct.chunked_type = Object.create(Struct.array_type)
		// copy over chunked functions
		for(var keys = Object.keys(define.struct.chunked_type), i = 0; i < keys.length; i++){
			var key = keys[i]
			Struct.chunked_type[key] = define.struct.chunked_type[key]
		}

		Struct.extend = function(body){
			var PrevConstruct = this
			function InheritStruct(){
				return PrevConstruct.apply(null, arguments)
			}
			// copy over prevConstruct
			for(var key in PrevConstruct){
				InheritStruct[key] = PrevConstruct[key]
			}
			var array = InheritStruct.array_type = Object.create(PrevConstruct.array_type)
			var chunk = InheritStruct.chunked_type = Object.create(array)
			// copy over chunked keys
			for(var keys = Object.keys(PrevConstruct.chunked_type), i = 0; i < keys.length; i++){
				var key = keys[i]
				chunk[key] = PrevConstruct.chunked_type[key]
			}

			body(InheritStruct, array, chunk)
			return InheritStruct
		}

		return Struct
	}

	define.struct.array_type = {}
	function structArray(self){

		// lets return the struct at index
		self.get = function(index){
			var out = this.array.subarray(this.slots * index)
			out.struct = Struct
			return out
		}

		self.ensureSize = function(length){
			if(length > this.allocated){
				// lets double the size of the buffer
				var oldsize = this.allocated * this.slots

				if(this.length > this.allocated * 2) this.allocated = this.length
				else this.allocated = this.allocated * 2 // exponential strategy

				var oldarray = this.array
				var newarray = new this.arrayconstructor(this.allocated * this.slots)				
				for(var i = 0; i < oldsize; i++) newarray[i] = oldarray[i]
				this.array = newarray
			}
		}

		self.set = function(index){
			if(index >= this.allocated) this.ensureSize(index)
			if(index >= this.length) this.length = index + 1
			var len = arguments.length - 1, base = index * this.slots
			this.clean = false
			if(len === this.slots) for(var i = 0; i < len; i++) this.array[base + i] = arguments[i + 1]
			else structInit(this.array, base, arguments, 1)
			return this
		}

		self.push = function(){
			this.length ++ 
			if(this.length >= this.allocated) this.ensureSize(this.length)
			this.clean = false
			var base = (this.length -1) * this.slots
			var len = arguments.length
			if(len === this.slots) for(var i = 0; i < len;i++) this.array[base + i] = arguments[i]
			else structInit(this.array, base, arguments, 0)
		}

		// triangle strip
		self.lengthStrip = function(){
			if(this.length % 2) throw new Error('Non aligned strip size')
			return this.length / 2
		}

		self.setStrip = function(index){
			this.clean = false
			var arglen = arguments.length - 1
			var slots = this.slots
			if(arglen !== slots * 2) throw new Error('Please use individual components to set a quad')
			var needed = index * 2
			if(needed >= this.allocated) this.ensureSize(needed)
			if(needed >= this.length) this.length = needed + 2
			var off = needed * slots
			var out = this.array
			for(var i = 0; i < slots; i++){ // iterate the components
				out[off + i      ] = arguments[i + 1]
				out[off + i + 1*slots] = arguments[i + 1*slots + 1]
			}
		}

		self.pushStrip = function(){
			this.clean = false
			var slots = this.slots
			if(arguments.length !== slots * 2) throw new Error('Please use individual components to set a quad for '+slots)
			var off = this.length * slots
			this.length += 2
			if(this.length >= this.allocated){
				this.ensureSize(this.length)
			}
			// ok so lets just write it out
			var out = this.array
			for(var i = 0; i < slots; i++){ // iterate the components
				out[off + i      ] = arguments[i]
				out[off + i + slots] = arguments[i + slots]
			}
		}

		// Simple quad geometry api
		// 0___14 
		// |   /|
		// |  / |
		// | /  |
		// |/   | 
		// 23---5

		self.lengthQuad = function(){
			if(this.length % 6) throw new Error('Non aligned quad size')
			return this.length / 6
		}

		self.setQuad = function(index){
			var arglen = arguments.length - 1
			var slots = this.slots
			if(arglen !== slots * 4) throw new Error('Please use individual components to set a quad')
			var needed = index * 6
			if(needed >= this.allocated) this.ensureSize(needed)
			if(needed >= this.length) this.length = needed + 6
			// ok so lets just write it out
			var off = needed * slots
			var out = this.array
			for(var i = 0; i < slots; i++){ // iterate the components
				out[off + i      ] = arguments[i + 1]
				out[off + i + 1*slots] = out[off + i + 4*slots] = arguments[i + 1*slots + 1]
				out[off + i + 2*slots] = out[off + i + 3*slots] = arguments[i + 2*slots + 1]
				out[off + i + 5*slots] = arguments[i + 3*slots + 1]
			}
		}

		self.pushQuad = function(){
			var slots = this.slots
			if(arguments.length !== slots * 4) throw new Error('Please use individual components to set a quad for '+slots)
			var off = this.length * slots
			this.length += 6
			if(this.length >= this.allocated){
				this.ensureSize(this.length)
			}
			// ok so lets just write it out
			var out = this.array
			for(var i = 0; i < slots; i++){ // iterate the components
				out[off + i      ] = arguments[i]
				out[off + i + 1*slots] = out[off + i + 4*slots] = arguments[i + 1*slots]
				out[off + i + 2*slots] = out[off + i + 3*slots] = arguments[i + 2*slots]
				out[off + i + 5*slots] = arguments[i + 3*slots]
			}
		}

		self.isArray = true

		return self
	}

	// we inherit from array
	structArray(define.struct.array_type)
	define.struct.chunked_type = Object.create(define.struct.array_type)
	function structChunked(self){
		self.isChunked = true
		return self
	}

	structChunked(define.struct.chunked_type)

	// make something global
	define.global = function(object){
		var glob = typeof process !== 'undefined'? global: window
		for(var key in object){
			glob[key] = object[key]
		}
	}

	// storage structures
	define.module = {}
	define.factory = {}

	// the environment we are in
	if(typeof window !== 'undefined') define.$environment = 'browser'
	else if(typeof process !== 'undefined') define.$environment = 'nodejs'
	else define.$environment = 'v8'

	if(define.packaged){
		define.require = define.localRequire('')
		return define
	}
	else if(typeof window !== 'undefined')(function(){ // browser implementation
		// if define was already defined use it as a config store
		define.$root = location.origin
		// storage structures
		define.download_queue = {}
		// the require function passed into the factory is local
		var app_root = define.filePath(window.location.href)

		// loadAsync is the resource loader
		define.loadAsync = function(files, from_file){

			function loadResource(url, from_file, recurblock){

				var ext = define.fileExt(url)
				var abs_url, fac_url

				if(url.indexOf('http:') === 0 && url.indexOf(define.$root) !== 0){ // we are fetching a url..
					fac_url = url
					abs_url = define.$root + '/proxy?' + encodeURIComponent(url)
				}
				else{
					abs_url = define.expandVariables(url)
					if(!ext) ext = 'js', abs_url += '.'  + ext
					fac_url = abs_url
				}

				var prom = define.download_queue[abs_url]

				if(prom){
					if(recurblock) return new Promise(function(resolve){resolve()})
					return prom
				}

				if(ext === 'js'){
					prom = loadScript(fac_url, abs_url, from_file)
				}
				else if(ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'png'){		
					prom = loadImage(fac_url, abs_url, from_file)
				}
				else  prom = loadXHR(fac_url, abs_url, from_file, ext)
				define.download_queue[abs_url] = prom
				return prom
			}

			function loadImage(facurl, url, from_file){
				return new Promise(function(resolve, reject){
					var img = new Image()
					img.src = url
					img.onerror = function(){
						var err = "Error loading " + url + " from " + from_file
						reject(err)
					}
					img.onload = function(){
						define.factory[facurl] = img
						resolve(img)
					}
				})
			}

			function loadXHR(facurl, url, from_file, type){
				return new Promise(function(resolve, reject){
					var req = new XMLHttpRequest()
					// todo, make type do other things
					if(type === 'json')	req.responseType = 'json'
					else req.responseType = 'arraybuffer'
					req.open("GET", url, true)
					req.onerror = function(){
						var err = "Error loading " + url + " from " + from_file
						console.error(err)
						reject(err)
					}
					req.onreadystatechange = function(){
						if(req.readyState == 4){
							if(req.status != 200){
								var err = "Error loading " + url + " from " + from_file
								console.error(err)
								return reject(err)
							}
							define.factory[facurl] = req.response
							resolve(req.response)
						}
					}
					req.send()
				})
			}

			// insert by script tag
			function loadScript(facurl, url, from_file){
				return new Promise(function(resolve, reject){
					var script = document.createElement('script')
					var base_path = define.filePath(url)

					script.type = 'text/javascript'
					script.src = url
					//define.script_tags[url] = script
						
					function onLoad(){
						// pull out the last factor
						var factory = define.last_factory
						define.factory[facurl] = factory
						define.last_factory = undefined
						if(!factory) return reject("Factory is null for "+url+" from file "+from_file)
						// parse the function for other requires
						var search = factory.toString()
						
						if(factory.body){
							// only do dependencies if environment matches
							if(factory.body.environment === undefined || factory.body.environment === define.$environment)
								search += '\n' + factory.body.toString()
						}
						if(factory.deps) search += '\n' + factory.deps.toString()

						Promise.all(define.findRequires(search).map(function(path){
							// Make path absolute and process variables
							var dep_path = define.joinPath(base_path, define.expandVariables(path))
							return loadResource(dep_path, url, true)
						})).then(function(){
							resolve(factory)
						},
						function(err){
							reject(err)
						})
					}

					script.onerror = function(){ 
						var err = "Error loading " + url + " from " + from_file
						console.error(err)
						reject(err)
					}
					script.onload = onLoad
					script.onreadystatechange = function(){
						if(s.readyState == 'loaded' || s.readyState == 'complete') onLoad()
					}
					document.getElementsByTagName('head')[0].appendChild(script)
				})
			}

			if(Array.isArray(files)){
				return Promise.all(files.map(function(file){
					return loadResource(file, from_file)
				}))
			}
			else return loadResource(files, from_file)
		}

		// make it available globally
		window.define = define

		// boot up using the MAIN property
		if(define.main){
			define.loadAsync(define.main, 'main').then(function(){
				if(define.atMain) define.atMain(define.localRequire(''), define.main)
			}, function(err){
				console.log("Error starting up " + err)
			})
		}
		window.out = console.log.bind(console)

		var backoff = 1
		define.autoreloadConnect = function(){

			if(this.reload_socket){
				this.reload_socket.onclose = undefined
				this.reload_socket.onerror = undefined
				this.reload_socket.onmessage = undefined
				this.reload_socket.onopen = undefined
				this.reload_socket.close()
				this.reload_socket = undefined
			}
			this.reload_socket = new WebSocket('ws://' + location.host)

			this.reload_socket.onopen = function(){
				backoff = 1
			}

			this.reload_socket.onerror = function(){
			}

			this.reload_socket.onclose = function(){
				if((backoff*=2) > 1000) backoff = 1000
				setTimeout(function(){ define.autoreloadConnect() }, backoff)
			}

			this.reload_socket.onmessage = function(event){
				var msg = JSON.parse(event.data)
				if (msg.type === 'filechange') {
					console.clear()
					location.href = location.href  // reload on filechange
				}
				else if (msg.type === 'close') {
					window.close() // close the window
				} 
				else if (msg.type === 'delay') { // a delay refresh message
					console.log('Got delay refresh from server!');
					setTimeout(function() {
						console.clear()
						location.href = location.href
					}, 1500)
				}
			}
		}
		define.autoreloadConnect()
	})()
	else (function(){ // nodeJS implementation
		module.exports = global.define = define

		define.$root = define.filePath(module.filename.replace(/\\/g,'/'))

		var Module = require("module")
		var modules = []
		var _compile = module.constructor.prototype._compile

		// hook compile to keep track of module objects
		module.constructor.prototype._compile = function(content, filename){  
			modules.push(this)
			try {
				return _compile.call(this, content, filename)
			}
			finally {
				modules.pop()
			}
		}

		define.define = function(factory) {

			if(factory instanceof Array) throw new Error("injects-style not supported")

			var module = modules[modules.length - 1] || require.main

			// store module and factory just like in the other envs
			define.module[module.filename] = module
			define.factory[module.filename] = factory

			function localRequire(name) {
				if(arguments.length != 1) throw new Error("Unsupported require style")

				name = define.expandVariables(name)

				var full_name = Module._resolveFilename(name, module)

				if (full_name instanceof Array) full_name = full_name[0]

				if(define.atRequire && full_name.charAt(0) == '/'){
					define.atRequire(full_name)
				}

				return require(full_name)
			}

			localRequire.clearCache = function(name){
				Module._cache = {}
			}

			module.factory = factory
			if (typeof factory !== "function") return module.exports = factory

			var ret = factory.call(module.exports, localRequire, module.exports, module)

			if(ret !== undefined) module.exports = ret

			if(define.atModule) define.atModule(module)
		}

		global.define.require = require
		global.define.module = {}
		global.define.factory = {}
		// fetch a new require for the main module and return that
		
		define.define(function(require){
			module.exports = require
		})
	})()
})(typeof define !== 'undefined' && define)

Object.defineProperty(Function.prototype, 'wired', {get:function(){
	this.isWired = true
	return this
}, set:function(){throw new Error('cant set wired')}})

define.promiseLib = function(exports){
	// Use polyfill for setImmediate for performance gains
	var asap = Promise.immediateFn || (typeof setImmediate === 'function' && setImmediate) ||
		function(fn) { setTimeout(fn, 1); }

	// Polyfill for Function.prototype.bind
	function bind(fn, thisArg) {
		return function() {
			fn.apply(thisArg, arguments)
		}
	}

	var isArray = Array.isArray || function(value) { return Object.prototype.toString.call(value) === "[object Array]" }

	function Promise(fn) {
		if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new')
		if (typeof fn !== 'function') throw new TypeError('not a function')
		this._state = null
		this._value = null
		this._deferreds = []

		doResolve(fn, bind(resolve, this), bind(reject, this))
	}

	function handle(deferred) {
		var me = this
		if (this._state === null) {
			this._deferreds.push(deferred)
			return
		}
		asap(function() {
			var cb = me._state ? deferred.onFulfilled : deferred.onRejected
			if (cb === null) {
				(me._state ? deferred.resolve : deferred.reject)(me._value)
				return
			}
			var ret;
			try {
				ret = cb(me._value)
			}
			catch (e) {
				deferred.reject(e)
				return;
			}
			deferred.resolve(ret)
		})
	}

	function resolve(newValue) {
		try { //Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
			if (newValue === this) throw new TypeError('A promise cannot be resolved with itself.')
			if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
				var then = newValue.then
				if (typeof then === 'function') {
					doResolve(bind(then, newValue), bind(resolve, this), bind(reject, this))
					return;
				}
			}
			this._state = true
			this._value = newValue
			finale.call(this)
		} catch (e) { reject.call(this, e); }
	}

	function reject(newValue) {
		this._state = false
		this._value = newValue
		finale.call(this)
	}

	function finale() {
		for (var i = 0, len = this._deferreds.length; i < len; i++) {
			handle.call(this, this._deferreds[i])
		}
		this._deferreds = null
	}

	function Handler(onFulfilled, onRejected, resolve, reject){
		this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null
		this.onRejected = typeof onRejected === 'function' ? onRejected : null
		this.resolve = resolve
		this.reject = reject
	}

	function doResolve(fn, onFulfilled, onRejected) {
		var done = false;
		try {
			fn(function (value) {
				if (done) return
				done = true
				onFulfilled(value)
			}, function (reason) {
				if (done) return
				done = true
				onRejected(reason)
			})
		} catch (ex) {
			if (done) return
			done = true
			onRejected(ex)
		}
	}

	Promise.prototype['catch'] = function (onRejected) {
		return this.then(null, onRejected);
	}

	Promise.prototype.then = function(onFulfilled, onRejected) {
		var me = this;
		return new Promise(function(resolve, reject) {
			handle.call(me, new Handler(onFulfilled, onRejected, resolve, reject))
		})
	}

	Promise.all = function () {
		var args = Array.prototype.slice.call(arguments.length === 1 && isArray(arguments[0]) ? arguments[0] : arguments)

		return new Promise(function (resolve, reject) {
			if (args.length === 0) return resolve([])
			var remaining = args.length
			function res(i, val) {
				try {
					if (val && (typeof val === 'object' || typeof val === 'function')) {
						var then = val.then
						if (typeof then === 'function') {
							then.call(val, function (val) { res(i, val) }, reject)
							return
						}
					}
					args[i] = val
					if (--remaining === 0) {
						resolve(args)
					}
				} catch (ex) {
					reject(ex)
				}
			}
			for (var i = 0; i < args.length; i++) {
				res(i, args[i])
			}
		})
	}

	Promise.resolve = function (value) {
		if (value && typeof value === 'object' && value.constructor === Promise) {
			return value
		}

		return new Promise(function (resolve) {
			resolve(value)
		})
	}

	Promise.reject = function (value) {
		return new Promise(function (resolve, reject) {
			reject(value)
		})
	}

	Promise.race = function (values) {
		return new Promise(function (resolve, reject) {
			for(var i = 0, len = values.length; i < len; i++) {
				values[i].then(resolve, reject)
			}
		})
	}

	exports.Promise = Promise
}
if(typeof Promise === 'undefined') define.promiseLib(typeof process !== 'undefined'? global: window)
