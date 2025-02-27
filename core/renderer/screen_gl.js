// Copyright 2015 Teem2 LLC, MIT License (see LICENSE)
// Sprite class

define.class('./screen_base', function (require, exports, self) {
	var GLDevice = require('$gl/gldevice')
	var GLShader = require('$gl/glshader')
	var GLTexture = require('$gl/gltexture')
	var Sprite = require('./sprite_gl')
	var Text = require('./text_gl')
	var RenderState = require('./renderstate_gl')
	var FlexLayout = require('$lib/layout')
	
	//self.attribute('time', {type:float, value: 0});
	//self.attribute('moved', {type:boolean, value : true});

	self.dirty = true

	self.atConstructor = function () {}

	self.render = function(){
		//console.log("render");
	}

	self.renderstate = new RenderState();

	self.debug = false

	self.lastx = -1;
	self.lasty = -1;

	self.logDebug = function(value){
		console.log(value)
		document.title = value
	}

	self.drawDebug = function () {
		this.renderstate.setup(this.device, 2, 2);
		this.renderstate.translate(-this.screen.mouse.x + 1, this.device.size[1] - (this.screen.mouse.y) - 1);
		this.renderstate.drawmode = 2;
		this.renderstate.debugtypes = []
		this.device.clear(vec4(0.5, 0.5, 0.5, 1))
		this.device.gl.clearStencil(0);

		for (var i = 0; i < this.children.length; i++) {
			this.children[i].draw(this.renderstate)
		}
		this.device.gl.readPixels(1 * this.device.ratio, 1 * this.device.ratio, 1, 1, this.device.gl.RGBA, this.device.gl.UNSIGNED_BYTE, this.buf);
		// lets decode the types
		var type = this.renderstate.debugtypes[0]
			if (type) {
				if (this.buf[0] == 127 && this.buf[1] == 127 && this.buf[2] == 127) {
					self.logDebug('no debug')
				} else {
					if (type == 'int') {
						var i = this.buf[2] < 128 ? -this.buf[0] : this.buf[0]// + this.buf[1]*255
							if (this.buf[1])
								i += this.buf[1] * 256
								self.logDebug(i)
					}
					if (type == 'float') {
						var i = this.buf[2] < 128 ? -this.buf[0] / 255 : this.buf[0] / 255 // + this.buf[1]*255
							if (this.buf[1])
								i += this.buf[1]
								self.logDebug(i)
					}
					if (type == 'vec2') {
						self.logDebug('(' + this.buf[0] / 255 + ',' + this.buf[1] / 255 + ')')
					}
					if (type == 'ivec2') {
						self.logDebug('(' + this.buf[0] + ',' + this.buf[1] + ')')
					}
					if (type == 'vec3') {
						self.logDebug('(' + this.buf[0] / 255 + ',' + this.buf[1] / 255 + ',' + this.buf[2] / 255 + ')')
					}
					if (type == 'ivec3') {
						self.logDebug('(' + this.buf[0] + ',' + this.buf[1] + ',' + this.buf[2] + ')')
					}
				}
			}
			//console.log(id)
	}

	self.drawGuid = function () {
		this.renderstate.setup(this.device, 2, 2);
		this.renderstate.translate(-this.screen.mouse.x + 1, this.device.size[1] - (this.screen.mouse.y) - 1);
		this.renderstate.drawmode = 1;

		this.device.clear(vec4(0, 0, 0, 1))
		this.device.gl.clearStencil(0);
		//this.device.clear(this.device.gl.STENCIL_BUFFER_BIT);
		for (var i = 0; i < this.children.length; i++) {
			this.children[i].draw(this.renderstate)
		}
	}

	self.readGuid = function () {
		//return
		//return
		this.device.gl.readPixels(1 * this.device.ratio, 1 * this.device.ratio, 1, 1, this.device.gl.RGBA, this.device.gl.UNSIGNED_BYTE, this.buf);
		var id = this.buf[0] + (this.buf[1] << 8) + (this.buf[2] << 16);
		this.lastidundermouse = id;

		if (this.screen.mousecapture !== false) {
			id = this.screen.mousecapture;
		}

		this.setguid(id);
	}

	self.setguid = function (id) {
		
		var screenw = this.device.main_frame.size[0]/ this.device.main_frame.ratio;
		var screenh = this.device.main_frame.size[1]/ this.device.main_frame.ratio;
		
		this.screen.mouse.glx = (this.screen.mouse.x/(screenw/2))-1;
		this.screen.mouse.gly=  -(this.screen.mouse.y/(screenh/2)-1);
				
		//var R = vec2.mul_mat4_t(vec2(this.screen.mouse.glx, this.screen.mouse.gly), this.invertedworldmatrix);

		if(id != this.screen.lastmouseguid || this.screen.mouse.x != this.lastx || this.screen.mouse.y != this.lasty){
			this.lastx = this.screen.mouse.x
			this.lasty = this.screen.mouse.y
			
			if(this.screen.guidmap[id].hasListeners('mousemove')){
				var M = this.screen.guidmap[id].getInvertedMatrix()
				var R = vec2.mul_mat4_t(vec2(this.screen.mouse.glx, this.screen.mouse.gly), M)
	
				this.screen.guidmap[id].emit('mousemove', vec2(R[0], R[1]))
			}
		}

		if(id != this.screen.lastmouseguid){

			this.screen.guidmap[this.screen.lastmouseguid].emit('mouseout')

			if (this.uieventdebug){
				$$("mouseout: " + this.screen.guidmap[this.screen.lastmouseguid].constructor.name + "(" + this.screen.lastmouseguid + ")")
			}
			if (this.uieventdebug){
				$$("mouseenter: " + this.screen.guidmap[id].constructor.name + "(" + id + ")")
			}

			this.screen.guidmap[id].emit('mouseover')
			this.screen.lastmouseguid = id
		}
	}

	self.drawColor = function () {
		this.renderstate.setup(this.device);
		this.orientation = {};
		
		this.orientation.worldmatrix = this.renderstate.matrix;
		this.invertedworldmatrix =  mat4.invert(this.orientation.worldmatrix)
		this.renderstate.debugmode = false;
		this.renderstate.drawmode = 0;
		this.device.clear(this.bgcolor)
		this.device.gl.clearStencil(0);
		//this.device.clear(this.device.gl.STENCIL_BUFFER_BIT);
		for (var i = 0; i < this.children.length; i++) {
			this.children[i].draw(this.renderstate)
		}
		this.renderstate.finish(this.device);
	}

	self.readGuidTimeout = function () {
		var dt = Date.now()
		this.device.setTargetFrame(this.pic_tex)
		this.readGuid()
	}
	
	self.dumped = 1;	
	self.dumpLayout = function(node, depth){
		if (this.dumped<=0) return;
		if (!depth) depth = "";
	//	if (depth === ""){
		console.log(depth, node.constructor.name, node.layout);
//		}
		for (var i = 0; i < node.children.length; i++) {
			this.dumpLayout(node.children[i], depth + " " );
		}
		if (depth ==="")  this.dumped --;
	}
	
	self.structuredumped = 1;	
	self.dumpStructure = function(node, depth){
		if (this.structuredumped<=0) return;
		if (!depth) depth = "";
	//	if (depth === ""){
		console.log(depth , node.constructor.name, node);
//		}
		for (var i = 0; i < node.children.length; i++) {
			this.dumpStructure(node.children[i], depth + " " );
		}
		if (depth ==="")  this.structuredumped --;
	}
	
	self.performLayout = function(){
		this._width = this.device.main_frame.size[0]/ this.device.main_frame.ratio;
		this._height = this.device.main_frame.size[1]/ this.device.main_frame.ratio;
		
		this._top = 0;
		this._left =0;
		this._right = this._width;
		this._bottom = this._height;
		
		FlexLayout.fillNodes(this);
		FlexLayout.computeLayout(this);
		// this.dumpLayout(this);
		// this.dumpStructure(this);
	}

	self.draw = function (time) {
		this.draw_calls = 0
		var anim = this.doAnimation(time)
		var delta = Date.now()
		this.time = Date.now()
		
		//this.performLayout();
		
		this.last_time = time
	
		if (this.debug === true) {
			if (!this.debug_tex.frame_buf) this.debug_tex.allocRenderTarget(this.device)
			this.device.setTargetFrame(this.debug_tex)
			this.drawDebug()
		}

		if (this.moved === true){//} || this.dirty === true) {
			this.moved = false
			if (!this.pic_tex.frame_buf) this.pic_tex.allocRenderTarget(this.device)
			this.device.setTargetFrame(this.pic_tex)
			this.drawGuid()
			// make sure reading the texture is delayed otherwise framerate is destroyed
			this.readGuidTimeout()
			//setTimeout(this.readGuidTimeout, 0)
		}
		
		if (this.dirty === true) {
			this.device.setTargetFrame()
			//for(var i = 0;i<20;i++)
			this.drawColor();
		}

		if(anim || this.hasListeners('time')) this.device.redraw()
		//console.log(this.draw_calls, Date.now() - delta)
	}

	self.setDirty = function(value){
		if (this.dirty === false && value === true && this.device !== undefined) {
			this.dirty = true
			this.device.redraw();
		}
	}

	self.onmoved = function (value) {
		if (value === true && this.device !== undefined) {
			this.device.redraw();
		}
		return value;
	}

	self.click = function () {
		if (this.screen.lastmouseguid > 0) {
			if (this.uieventdebug)
				console.log(" clicked: " + this.screen.guidmap[this.screen.lastmouseguid].constructor.name);
			this.screen.guidmap[this.screen.lastmouseguid].emit('click')
		}
	}

	self.init = function (parent) {
		this.pic_tex = GLTexture.rgba_depth_stencil(16, 16)
		this.debug_tex = GLTexture.rgba_depth_stencil(16, 16)

		this.readGuidTimeout = this.readGuidTimeout.bind(this)
		this.effectiveguid = 0;
		this.buf = new Uint8Array(4);
		this.screen.guidmap = {};
		this.screen.guidmap[0] = this;
		this.screen.mousecapture = false;
		this.screen.mousecapturecount = false;
		this.screen.lastmouseguid = 0;
		this.lastidundermouse = 0;

		this.screen.mouse.move = function () {
			if (this.screen.mousecapture){
				this.setguid (this.screen.lastmouseguid);
			}
			else{
				this.moved = true;
				//setTimeout(function(){
					//this.device.animFrame(0)
				//},0)////.bind(this),0)
			}
		}.bind(this)

		this.screen.mouse.isdown = function () {
			if (this.screen.mouse.isdown === 1) {
				if (this.screen.mousecapture === false) {
					this.screen.mousecapture = this.screen.lastmouseguid;
					this.screen.mousecapturecount = 1;
				} 
				else {
					this.screen.mousecapturecount++;
				}

				this.screen.guidmap[this.screen.lastmouseguid].emit('mousedown')
			} 
			else {
				if (this.screen.mouse.isdown === 0) {
					this.screen.mousecapturecount--;
					this.screen.guidmap[this.screen.lastmouseguid].emit('mouseup')
					if (this.screen.mousecapturecount === 0) {
						this.screen.mousecapture = false;
						this.setguid(this.lastidundermouse);
					}
				}
			}
		}.bind(this)

		this.screen.mouse.click = function () {
			this.click();
		}.bind(this)

		this.device = new GLDevice()
		console.log(this.device.size);
		this.renderstate.configure(this.device, this.device.size[0], this.device.size[1]);
		this.device.atRedraw = function (time) {
			this.draw(time / 1000.)
		}.bind(this)
	}
})
