// --- Polyfills ---
// Object.assign
if (typeof Object.assign != 'function') {
  (function () {
    Object.assign = function (target) {
      'use strict';
      if (target === undefined || target === null) {
        throw new TypeError('Cannot convert undefined or null to object');
      }

      var output = Object(target);
      for (var index = 1; index < arguments.length; index++) {
        var source = arguments[index];
        if (source !== undefined && source !== null) {
          for (var nextKey in source) {
            if (source.hasOwnProperty(nextKey)) {
              output[nextKey] = source[nextKey];
            }
          }
        }
      }
      return output;
    };
  })();
}

var DON = {
	instances : [],
	observe : function(){
		setInterval(function(){
			for (var i = DON.instances.length - 1; i >= 0; i--) {
				DON.instances[i].checkState();
			};
		}, 10);
	},
	compare : function (a, b) {
		var changes = [];
	    var aProps = Object.getOwnPropertyNames(a);

	    for (var i = 0; i < aProps.length; i++) {
	        var propName = aProps[i];
	        if (a[propName] !== b[propName]) changes.push(propName);
	    }


	    if(changes.length > 0) return {same : false, changes : changes};
	    else return {same : true};
	},
	template : function(str, vars, state){
		var templateVars = str.match(/{([^{}]+)}/g, "$1");
		for (var i = templateVars.length - 1; i >= 0; i--) {
			var index = vars.indexOf(templateVars[i].replace('{', '').replace('}', ''))
			if(index !== -1) str = str.replace(templateVars[i], state[vars[index]]);
		};
		return str;
	}
}

// --- Corleone ---
function Corleone(selector, data){
	this.events = data.events || false;
	this.state = data.state || false;
	this.oldState;
	this.methods = data.methods || false;
	this.elements = document.querySelectorAll(selector);
	this.bindings = {};
}
Corleone.prototype = {
	before : function(){
		if(this.events){
			if('before' in this.events){
				var elements = (this.elements.length == 1 ? this.elements[0] : this.elements);
				this.events.before.bind(Object.assign(this.state, this.methods))(elements);
			}
		}
	},
	ready : function(){
		this.oldState = Object.assign({}, this.state);
		if(this.events){
			if('ready' in this.events){
				var elements = (this.elements.length == 1 ? this.elements[0] : this.elements);
				this.events.ready.bind(Object.assign(this.state, this.methods))(elements);
			}
		}
	},
	checkState : function(){
		var updateDom = function(changes){
			var domUpdate = new Performance('DOM update');
			var elementsToUpdate = [];
			for (var i = changes.length - 1; i >= 0; i--) {
				if(changes[i] in this.bindings){
					var binding = this.bindings[changes[i]];
					for (var x = binding.length - 1; x >= 0; x--) {
						elementsToUpdate.push(binding[x]);
					};
				}
			};
			for (var x = elementsToUpdate.length - 1; x >= 0; x--) {
				var attribute = elementsToUpdate[x].attribute.replace(/ /g,'');
				var injects = attribute.split(',');
				var collections = {};

				for (var i = injects.length - 1; i >= 0; i--) {
					var donInject = injects[i].split(':');

					if(elementsToUpdate[x].subject == donInject[0]){
						if(!(donInject[0] in collections)) collections[donInject[0]] = [];
						collections[donInject[0]].push(donInject[1]);
					}
				}

				for(key in collections){
					switch(key){
						case 'text':
							elementsToUpdate[x].node.textContent = DON.template(elementsToUpdate[x].originalState, collections[key], this.state);
						break;

						default:
							elementsToUpdate[x].node.setAttribute(key, DON.template(elementsToUpdate[x].originalState, collections[key], this.state));
					}
				}
			};
			domUpdate.measure();
		}.bind(this);

		var comparison = DON.compare(this.oldState, this.state);
		if(!comparison.same){
			updateDom(comparison.changes);
			this.oldState = Object.assign({}, this.state);
		}
	},
	addEvents : function(){
		// Apply event handlers
		if(this.events){
			for (var i = 0; i < this.elements.length; i++) {
				for(eventName in this.events){
					if(eventName !== 'ready'){
						var thisCallback = function(e){
							this.proto.events[this.eventName].bind(this.proto.state)(e, this.element);
						};
						this.elements[i].addEventListener(eventName, thisCallback.bind({proto : this, element : this.elements[i], eventName : eventName}), false);
					}
				}
			};
		}
	},
	buildDonDOM : function(){
		var foundDon = {
			events : [],
			injects : []
		};

		var getDonDOM = function(element, selector, output){
			var query = element.querySelectorAll(selector);
			query = Array.prototype.slice.call(query);
			foundDon[output] = foundDon[output].concat(query);
		}

		// Collect don elements
		for (var i = this.elements.length - 1; i >= 0; i--) {
			getDonDOM(this.elements[i], '*[don-on]', 'events');
			getDonDOM(this.elements[i], '*[don-bind]', 'injects');
		};
		if(this.methods){
			// Handle event types
			for (var x = foundDon.events.length - 1; x >= 0; x--) {
				var attribute = foundDon.events[x].getAttribute('don-on').replace(/ /g,'');
				var events = attribute.split(',');

				for (var i = events.length - 1; i >= 0; i--) {
					var donEvent = events[i].split(':');
					var thisCallback = function(e){
						this.proto.methods[this.methodName].bind(this.proto.state)(e, this.element);
					};
					foundDon.events[x].addEventListener(donEvent[0], thisCallback.bind({proto : this, element : foundDon.events[x], methodName : donEvent[1]}), false);
				};
				foundDon.events[x].removeAttribute('don-on');
			};
		}
		if(this.state){
			// Handle injection types
			for (var x = foundDon.injects.length - 1; x >= 0; x--) {
				var attribute = foundDon.injects[x].getAttribute('don-bind').replace(/ /g,'');
				var injects = attribute.split(',');
				var collections = {};

				for (var i = injects.length - 1; i >= 0; i--) {
					var donInject = injects[i].split(':');

					if(!(donInject[0] in collections)) collections[donInject[0]] = [];
					collections[donInject[0]].push(donInject[1]);

					if(!(donInject[1] in this.bindings)) this.bindings[donInject[1]] = [];
					var binding = {subject : donInject[0], node : foundDon.injects[x], attribute : attribute};
					switch(donInject[0]){
						case 'text':
							binding.originalState = foundDon.injects[x].textContent;
						break;

						default:
							binding.originalState = foundDon.injects[x].getAttribute(donInject[0]);
					}
					this.bindings[donInject[1]].push(binding);
				}

				for(key in collections){
					switch(key){
						case 'text':
							var thisText = foundDon.injects[x].textContent;
							foundDon.injects[x].textContent = DON.template(thisText, collections[key], this.state);
						break;

						default:
							var thisAttribute = foundDon.injects[x].getAttribute(key);
							foundDon.injects[x].setAttribute(key, DON.template(thisAttribute, collections[key], this.state));
					}
				}

				foundDon.injects[x].removeAttribute('don-bind');
			};
		}
	}
}

var Don = function(selector, data){
	var performance = new Performance('Don Exec on '+selector, 3);

	var corleone = new Corleone(selector, data);
	corleone.before();
	corleone.addEvents();
	corleone.buildDonDOM();
	corleone.ready();

	DON.instances.push(corleone);

	performance.measure();
	return corleone.state;
}

// Enable the state change observer
DON.observe();

// --- NOTES ---
// Find alternative for Object.assign, browser support too crappy