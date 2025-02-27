// Copyright 2015 Teem2 LLC, MIT License (see LICENSE)
// Acorn binding walker

define.class("$parsers/onejsgen", function(require, exports, self){

	self.newState = function(){
		return {
			depth:"",
			references:[]
		}
	}

	self.Index = function(node, parent, state){
		if(!state.expr || node.index.type !== 'Value') throw new Error("Cannot property bind to dynamic index")
		state.expr.unshift(node.index.value)
	
		return this.expand(node.object, node, state) + '[' + node.index.value + ']'
	}

	self.Key = function(node, parent, state){
		// ok we are a member expression
		if(parent.type !== 'Call'){
			if(state.expr) state.expr.unshift(node.key.name)
			else {
				state = Object.create(state)
				state.expr = [node.key.name]
				state.references.push(state.expr)
			}
		}
		return this.expand(node.object, node, state) + '.' + node.key.name
	}

	self.This = function(node, parent, state){
		if(state.expr) state.expr.unshift('this')
		return 'this'
	}

	self.Id = function(node, parent, state){
		if(state.expr) state.expr.unshift(node.name)
		return node.name
	}
	
	self.Value = function(node, parent, state){
		return node.raw
	}	
})
