(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["uncaught"] = factory();
	else
		root["uncaught"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports) {

	/**
	 * @overview Module for handle uncaught errors and promises rejections
	 */

	'use strict';

	/**
	 * Defines execution environment
	 */

	var isBrowser = typeof window !== 'undefined';

	/**
	 * Listeners list, which are registered for uncaught errors and promises rejections
	 */
	var listeners = [];

	/**
	 * Sign of module own handlers registration
	 */
	var handlersAreRegistered = false;

	/**
	 * Sign of module own handlers working status
	 */
	var handlersAreTurnedOn = false;

	module.exports = {

	    /**
	     * Starts handling for uncaught errors and promises rejections
	     */
	    start: function start() {
	        if (handlersAreTurnedOn) {
	            return;
	        }

	        if (!handlersAreRegistered) {
	            if (isBrowser) {
	                // Listen to uncaught errors
	                window.addEventListener('error', browserErrorHandler);
	                // Listen to uncaught promises rejections
	                window.addEventListener('unhandledrejection', browserRejectionHandler);
	            } else {
	                process.on('uncaughtException', nodeErrorHandler);
	                process.on('unhandledRejection', nodeRejectionHandler);
	            }

	            handlersAreRegistered = true;
	        }

	        handlersAreTurnedOn = true;
	    },


	    /**
	     * Stops handling
	     */
	    stop: function stop() {
	        if (!handlersAreTurnedOn) {
	            return;
	        }

	        if (isBrowser) {
	            window.removeEventListener('error', browserErrorHandler);
	            window.removeEventListener('unhandledrejection', browserRejectionHandler);

	            handlersAreRegistered = false;
	        }

	        handlersAreTurnedOn = false;
	    },


	    /**
	     * Adds listener to list
	     * @param {Function} listener
	     */
	    addListener: function addListener(listener) {
	        if (typeof listener === 'function') {
	            listeners.push(listener);
	        }
	    },


	    /**
	     * Removes listener from list
	     * @param {Function} listener
	     */
	    removeListener: function removeListener(listener) {
	        var index = listeners.indexOf(listener);

	        if (index > -1) {
	            listeners.splice(index, 1);
	        }
	    },


	    /**
	     * Removes all listeners
	     */
	    removeAllListeners: function removeAllListeners() {
	        listeners.length = 0;
	    },


	    /**
	     * Flushes module: stops handling and removes all listeners
	     */
	    flush: function flush() {
	        this.removeAllListeners();
	        this.stop();
	    }
	};

	/**
	 * Handler for browser uncaught errors
	 * @param {Object} event
	 */
	function browserErrorHandler(event) {
	    var error = event ? event.error : undefined;
	    callListeners(error, event);
	}

	/**
	 * Handler for browser uncaught promises rejections
	 * @param {Object} event
	 */
	function browserRejectionHandler(event) {
	    var error = event ? event.reason : undefined;
	    callListeners(error, event);
	}

	/**
	 * Handler for Node.js uncaught errors
	 * @param {Object} error
	 */
	function nodeErrorHandler(error) {
	    if (handlersAreTurnedOn) {
	        callListeners(error, null);
	    }
	}

	/**
	 * Handler for Node.js uncaught promises rejections
	 * @param {Object} reason
	 */
	function nodeRejectionHandler(reason) {
	    if (handlersAreTurnedOn) {
	        callListeners(reason, null);
	    }
	}

	/**
	 * Send error data to all listeners
	 * @param {Object} error
	 * @param {Object} event
	 */
	function callListeners(error, event) {
	    listeners.forEach(function (listener) {
	        listener(error, event);
	    });
	}

/***/ }
/******/ ])
});
;