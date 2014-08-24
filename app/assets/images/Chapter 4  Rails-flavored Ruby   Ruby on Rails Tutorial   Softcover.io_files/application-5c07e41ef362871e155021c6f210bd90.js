(function($, undefined) {

/**
 * Unobtrusive scripting adapter for jQuery
 * https://github.com/rails/jquery-ujs
 *
 * Requires jQuery 1.7.0 or later.
 *
 * Released under the MIT license
 *
 */

  // Cut down on the number of issues from people inadvertently including jquery_ujs twice
  // by detecting and raising an error when it happens.
  if ( $.rails !== undefined ) {
    $.error('jquery-ujs has already been loaded!');
  }

  // Shorthand to make it a little easier to call public rails functions from within rails.js
  var rails;
  var $document = $(document);

  $.rails = rails = {
    // Link elements bound by jquery-ujs
    linkClickSelector: 'a[data-confirm], a[data-method], a[data-remote], a[data-disable-with]',

    // Button elements bound by jquery-ujs
    buttonClickSelector: 'button[data-remote]',

    // Select elements bound by jquery-ujs
    inputChangeSelector: 'select[data-remote], input[data-remote], textarea[data-remote]',

    // Form elements bound by jquery-ujs
    formSubmitSelector: 'form',

    // Form input elements bound by jquery-ujs
    formInputClickSelector: 'form input[type=submit], form input[type=image], form button[type=submit], form button:not([type])',

    // Form input elements disabled during form submission
    disableSelector: 'input[data-disable-with], button[data-disable-with], textarea[data-disable-with]',

    // Form input elements re-enabled after form submission
    enableSelector: 'input[data-disable-with]:disabled, button[data-disable-with]:disabled, textarea[data-disable-with]:disabled',

    // Form required input elements
    requiredInputSelector: 'input[name][required]:not([disabled]),textarea[name][required]:not([disabled])',

    // Form file input elements
    fileInputSelector: 'input[type=file]',

    // Link onClick disable selector with possible reenable after remote submission
    linkDisableSelector: 'a[data-disable-with]',

    // Make sure that every Ajax request sends the CSRF token
    CSRFProtection: function(xhr) {
      var token = $('meta[name="csrf-token"]').attr('content');
      if (token) xhr.setRequestHeader('X-CSRF-Token', token);
    },

    // making sure that all forms have actual up-to-date token(cached forms contain old one)
    refreshCSRFTokens: function(){
      var csrfToken = $('meta[name=csrf-token]').attr('content');
      var csrfParam = $('meta[name=csrf-param]').attr('content');
      $('form input[name="' + csrfParam + '"]').val(csrfToken);
    },

    // Triggers an event on an element and returns false if the event result is false
    fire: function(obj, name, data) {
      var event = $.Event(name);
      obj.trigger(event, data);
      return event.result !== false;
    },

    // Default confirm dialog, may be overridden with custom confirm dialog in $.rails.confirm
    confirm: function(message) {
      return confirm(message);
    },

    // Default ajax function, may be overridden with custom function in $.rails.ajax
    ajax: function(options) {
      return $.ajax(options);
    },

    // Default way to get an element's href. May be overridden at $.rails.href.
    href: function(element) {
      return element.attr('href');
    },

    // Submits "remote" forms and links with ajax
    handleRemote: function(element) {
      var method, url, data, elCrossDomain, crossDomain, withCredentials, dataType, options;

      if (rails.fire(element, 'ajax:before')) {
        elCrossDomain = element.data('cross-domain');
        crossDomain = elCrossDomain === undefined ? null : elCrossDomain;
        withCredentials = element.data('with-credentials') || null;
        dataType = element.data('type') || ($.ajaxSettings && $.ajaxSettings.dataType);

        if (element.is('form')) {
          method = element.attr('method');
          url = element.attr('action');
          data = element.serializeArray();
          // memoized value from clicked submit button
          var button = element.data('ujs:submit-button');
          if (button) {
            data.push(button);
            element.data('ujs:submit-button', null);
          }
        } else if (element.is(rails.inputChangeSelector)) {
          method = element.data('method');
          url = element.data('url');
          data = element.serialize();
          if (element.data('params')) data = data + "&" + element.data('params');
        } else if (element.is(rails.buttonClickSelector)) {
          method = element.data('method') || 'get';
          url = element.data('url');
          data = element.serialize();
          if (element.data('params')) data = data + "&" + element.data('params');
        } else {
          method = element.data('method');
          url = rails.href(element);
          data = element.data('params') || null;
        }

        options = {
          type: method || 'GET', data: data, dataType: dataType,
          // stopping the "ajax:beforeSend" event will cancel the ajax request
          beforeSend: function(xhr, settings) {
            if (settings.dataType === undefined) {
              xhr.setRequestHeader('accept', '*/*;q=0.5, ' + settings.accepts.script);
            }
            return rails.fire(element, 'ajax:beforeSend', [xhr, settings]);
          },
          success: function(data, status, xhr) {
            element.trigger('ajax:success', [data, status, xhr]);
          },
          complete: function(xhr, status) {
            element.trigger('ajax:complete', [xhr, status]);
          },
          error: function(xhr, status, error) {
            element.trigger('ajax:error', [xhr, status, error]);
          },
          crossDomain: crossDomain
        };

        // There is no withCredentials for IE6-8 when
        // "Enable native XMLHTTP support" is disabled
        if (withCredentials) {
          options.xhrFields = {
            withCredentials: withCredentials
          };
        }

        // Only pass url to `ajax` options if not blank
        if (url) { options.url = url; }

        var jqxhr = rails.ajax(options);
        element.trigger('ajax:send', jqxhr);
        return jqxhr;
      } else {
        return false;
      }
    },

    // Handles "data-method" on links such as:
    // <a href="/users/5" data-method="delete" rel="nofollow" data-confirm="Are you sure?">Delete</a>
    handleMethod: function(link) {
      var href = rails.href(link),
        method = link.data('method'),
        target = link.attr('target'),
        csrfToken = $('meta[name=csrf-token]').attr('content'),
        csrfParam = $('meta[name=csrf-param]').attr('content'),
        form = $('<form method="post" action="' + href + '"></form>'),
        metadataInput = '<input name="_method" value="' + method + '" type="hidden" />';

      if (csrfParam !== undefined && csrfToken !== undefined) {
        metadataInput += '<input name="' + csrfParam + '" value="' + csrfToken + '" type="hidden" />';
      }

      if (target) { form.attr('target', target); }

      form.hide().append(metadataInput).appendTo('body');
      form.submit();
    },

    /* Disables form elements:
      - Caches element value in 'ujs:enable-with' data store
      - Replaces element text with value of 'data-disable-with' attribute
      - Sets disabled property to true
    */
    disableFormElements: function(form) {
      form.find(rails.disableSelector).each(function() {
        var element = $(this), method = element.is('button') ? 'html' : 'val';
        element.data('ujs:enable-with', element[method]());
        element[method](element.data('disable-with'));
        element.prop('disabled', true);
      });
    },

    /* Re-enables disabled form elements:
      - Replaces element text with cached value from 'ujs:enable-with' data store (created in `disableFormElements`)
      - Sets disabled property to false
    */
    enableFormElements: function(form) {
      form.find(rails.enableSelector).each(function() {
        var element = $(this), method = element.is('button') ? 'html' : 'val';
        if (element.data('ujs:enable-with')) element[method](element.data('ujs:enable-with'));
        element.prop('disabled', false);
      });
    },

   /* For 'data-confirm' attribute:
      - Fires `confirm` event
      - Shows the confirmation dialog
      - Fires the `confirm:complete` event

      Returns `true` if no function stops the chain and user chose yes; `false` otherwise.
      Attaching a handler to the element's `confirm` event that returns a `falsy` value cancels the confirmation dialog.
      Attaching a handler to the element's `confirm:complete` event that returns a `falsy` value makes this function
      return false. The `confirm:complete` event is fired whether or not the user answered true or false to the dialog.
   */
    allowAction: function(element) {
      var message = element.data('confirm'),
          answer = false, callback;
      if (!message) { return true; }

      if (rails.fire(element, 'confirm')) {
        answer = rails.confirm(message);
        callback = rails.fire(element, 'confirm:complete', [answer]);
      }
      return answer && callback;
    },

    // Helper function which checks for blank inputs in a form that match the specified CSS selector
    blankInputs: function(form, specifiedSelector, nonBlank) {
      var inputs = $(), input, valueToCheck,
          selector = specifiedSelector || 'input,textarea',
          allInputs = form.find(selector);

      allInputs.each(function() {
        input = $(this);
        valueToCheck = input.is('input[type=checkbox],input[type=radio]') ? input.is(':checked') : input.val();
        // If nonBlank and valueToCheck are both truthy, or nonBlank and valueToCheck are both falsey
        if (!valueToCheck === !nonBlank) {

          // Don't count unchecked required radio if other radio with same name is checked
          if (input.is('input[type=radio]') && allInputs.filter('input[type=radio]:checked[name="' + input.attr('name') + '"]').length) {
            return true; // Skip to next input
          }

          inputs = inputs.add(input);
        }
      });
      return inputs.length ? inputs : false;
    },

    // Helper function which checks for non-blank inputs in a form that match the specified CSS selector
    nonBlankInputs: function(form, specifiedSelector) {
      return rails.blankInputs(form, specifiedSelector, true); // true specifies nonBlank
    },

    // Helper function, needed to provide consistent behavior in IE
    stopEverything: function(e) {
      $(e.target).trigger('ujs:everythingStopped');
      e.stopImmediatePropagation();
      return false;
    },

    //  replace element's html with the 'data-disable-with' after storing original html
    //  and prevent clicking on it
    disableElement: function(element) {
      element.data('ujs:enable-with', element.html()); // store enabled state
      element.html(element.data('disable-with')); // set to disabled state
      element.bind('click.railsDisable', function(e) { // prevent further clicking
        return rails.stopEverything(e);
      });
    },

    // restore element to its original state which was disabled by 'disableElement' above
    enableElement: function(element) {
      if (element.data('ujs:enable-with') !== undefined) {
        element.html(element.data('ujs:enable-with')); // set to old enabled state
        element.removeData('ujs:enable-with'); // clean up cache
      }
      element.unbind('click.railsDisable'); // enable element
    }

  };

  if (rails.fire($document, 'rails:attachBindings')) {

    $.ajaxPrefilter(function(options, originalOptions, xhr){ if ( !options.crossDomain ) { rails.CSRFProtection(xhr); }});

    $document.delegate(rails.linkDisableSelector, 'ajax:complete', function() {
        rails.enableElement($(this));
    });

    $document.delegate(rails.linkClickSelector, 'click.rails', function(e) {
      var link = $(this), method = link.data('method'), data = link.data('params'), metaClick = e.metaKey || e.ctrlKey;
      if (!rails.allowAction(link)) return rails.stopEverything(e);

      if (!metaClick && link.is(rails.linkDisableSelector)) rails.disableElement(link);

      if (link.data('remote') !== undefined) {
        if (metaClick && (!method || method === 'GET') && !data) { return true; }

        var handleRemote = rails.handleRemote(link);
        // response from rails.handleRemote() will either be false or a deferred object promise.
        if (handleRemote === false) {
          rails.enableElement(link);
        } else {
          handleRemote.error( function() { rails.enableElement(link); } );
        }
        return false;

      } else if (link.data('method')) {
        rails.handleMethod(link);
        return false;
      }
    });

    $document.delegate(rails.buttonClickSelector, 'click.rails', function(e) {
      var button = $(this);
      if (!rails.allowAction(button)) return rails.stopEverything(e);

      rails.handleRemote(button);
      return false;
    });

    $document.delegate(rails.inputChangeSelector, 'change.rails', function(e) {
      var link = $(this);
      if (!rails.allowAction(link)) return rails.stopEverything(e);

      rails.handleRemote(link);
      return false;
    });

    $document.delegate(rails.formSubmitSelector, 'submit.rails', function(e) {
      var form = $(this),
        remote = form.data('remote') !== undefined,
        blankRequiredInputs = rails.blankInputs(form, rails.requiredInputSelector),
        nonBlankFileInputs = rails.nonBlankInputs(form, rails.fileInputSelector);

      if (!rails.allowAction(form)) return rails.stopEverything(e);

      // skip other logic when required values are missing or file upload is present
      if (blankRequiredInputs && form.attr("novalidate") == undefined && rails.fire(form, 'ajax:aborted:required', [blankRequiredInputs])) {
        return rails.stopEverything(e);
      }

      if (remote) {
        if (nonBlankFileInputs) {
          // slight timeout so that the submit button gets properly serialized
          // (make it easy for event handler to serialize form without disabled values)
          setTimeout(function(){ rails.disableFormElements(form); }, 13);
          var aborted = rails.fire(form, 'ajax:aborted:file', [nonBlankFileInputs]);

          // re-enable form elements if event bindings return false (canceling normal form submission)
          if (!aborted) { setTimeout(function(){ rails.enableFormElements(form); }, 13); }

          return aborted;
        }

        rails.handleRemote(form);
        return false;

      } else {
        // slight timeout so that the submit button gets properly serialized
        setTimeout(function(){ rails.disableFormElements(form); }, 13);
      }
    });

    $document.delegate(rails.formInputClickSelector, 'click.rails', function(event) {
      var button = $(this);

      if (!rails.allowAction(button)) return rails.stopEverything(event);

      // register the pressed submit button
      var name = button.attr('name'),
        data = name ? {name:name, value:button.val()} : null;

      button.closest('form').data('ujs:submit-button', data);
    });

    $document.delegate(rails.formSubmitSelector, 'ajax:beforeSend.rails', function(event) {
      if (this == event.target) rails.disableFormElements($(this));
    });

    $document.delegate(rails.formSubmitSelector, 'ajax:complete.rails', function(event) {
      if (this == event.target) rails.enableFormElements($(this));
    });

    $(function(){
      rails.refreshCSRFTokens();
    });
  }

})( jQuery );
/*!
 * jQuery Templates Plugin 1.0.0pre
 * http://github.com/jquery/jquery-tmpl
 * Requires jQuery 1.4.2
 *
 * Copyright 2011, Software Freedom Conservancy, Inc.
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 */

(function( jQuery, undefined ){
	var oldManip = jQuery.fn.domManip, tmplItmAtt = "_tmplitem", htmlExpr = /^[^<]*(<[\w\W]+>)[^>]*$|\{\{\! /,
		newTmplItems = {}, wrappedItems = {}, appendToTmplItems, topTmplItem = { key: 0, data: {} }, itemKey = 0, cloneIndex = 0, stack = [];

	function newTmplItem( options, parentItem, fn, data ) {
		// Returns a template item data structure for a new rendered instance of a template (a 'template item').
		// The content field is a hierarchical array of strings and nested items (to be
		// removed and replaced by nodes field of dom elements, once inserted in DOM).
		var newItem = {
			data: data || (data === 0 || data === false) ? data : (parentItem ? parentItem.data : {}),
			_wrap: parentItem ? parentItem._wrap : null,
			tmpl: null,
			parent: parentItem || null,
			nodes: [],
			calls: tiCalls,
			nest: tiNest,
			wrap: tiWrap,
			html: tiHtml,
			update: tiUpdate
		};
		if ( options ) {
			jQuery.extend( newItem, options, { nodes: [], parent: parentItem });
		}
		if ( fn ) {
			// Build the hierarchical content to be used during insertion into DOM
			newItem.tmpl = fn;
			newItem._ctnt = newItem._ctnt || newItem.tmpl( jQuery, newItem );
			newItem.key = ++itemKey;
			// Keep track of new template item, until it is stored as jQuery Data on DOM element
			(stack.length ? wrappedItems : newTmplItems)[itemKey] = newItem;
		}
		return newItem;
	}

	// Override appendTo etc., in order to provide support for targeting multiple elements. (This code would disappear if integrated in jquery core).
	jQuery.each({
		appendTo: "append",
		prependTo: "prepend",
		insertBefore: "before",
		insertAfter: "after",
		replaceAll: "replaceWith"
	}, function( name, original ) {
		jQuery.fn[ name ] = function( selector ) {
			var ret = [], insert = jQuery( selector ), elems, i, l, tmplItems,
				parent = this.length === 1 && this[0].parentNode;

			appendToTmplItems = newTmplItems || {};
			if ( parent && parent.nodeType === 11 && parent.childNodes.length === 1 && insert.length === 1 ) {
				insert[ original ]( this[0] );
				ret = this;
			} else {
				for ( i = 0, l = insert.length; i < l; i++ ) {
					cloneIndex = i;
					elems = (i > 0 ? this.clone(true) : this).get();
					jQuery( insert[i] )[ original ]( elems );
					ret = ret.concat( elems );
				}
				cloneIndex = 0;
				ret = this.pushStack( ret, name, insert.selector );
			}
			tmplItems = appendToTmplItems;
			appendToTmplItems = null;
			jQuery.tmpl.complete( tmplItems );
			return ret;
		};
	});

	jQuery.fn.extend({
		// Use first wrapped element as template markup.
		// Return wrapped set of template items, obtained by rendering template against data.
		tmpl: function( data, options, parentItem ) {
			return jQuery.tmpl( this[0], data, options, parentItem );
		},

		// Find which rendered template item the first wrapped DOM element belongs to
		tmplItem: function() {
			return jQuery.tmplItem( this[0] );
		},

		// Consider the first wrapped element as a template declaration, and get the compiled template or store it as a named template.
		template: function( name ) {
			return jQuery.template( name, this[0] );
		},

		domManip: function( args, table, callback, options ) {
			if ( args[0] && jQuery.isArray( args[0] )) {
				var dmArgs = jQuery.makeArray( arguments ), elems = args[0], elemsLength = elems.length, i = 0, tmplItem;
				while ( i < elemsLength && !(tmplItem = jQuery.data( elems[i++], "tmplItem" ))) {}
				if ( tmplItem && cloneIndex ) {
					dmArgs[2] = function( fragClone ) {
						// Handler called by oldManip when rendered template has been inserted into DOM.
						jQuery.tmpl.afterManip( this, fragClone, callback );
					};
				}
				oldManip.apply( this, dmArgs );
			} else {
				oldManip.apply( this, arguments );
			}
			cloneIndex = 0;
			if ( !appendToTmplItems ) {
				jQuery.tmpl.complete( newTmplItems );
			}
			return this;
		}
	});

	jQuery.extend({
		// Return wrapped set of template items, obtained by rendering template against data.
		tmpl: function( tmpl, data, options, parentItem ) {
			var ret, topLevel = !parentItem;
			if ( topLevel ) {
				// This is a top-level tmpl call (not from a nested template using {{tmpl}})
				parentItem = topTmplItem;
				tmpl = jQuery.template[tmpl] || jQuery.template( null, tmpl );
				wrappedItems = {}; // Any wrapped items will be rebuilt, since this is top level
			} else if ( !tmpl ) {
				// The template item is already associated with DOM - this is a refresh.
				// Re-evaluate rendered template for the parentItem
				tmpl = parentItem.tmpl;
				newTmplItems[parentItem.key] = parentItem;
				parentItem.nodes = [];
				if ( parentItem.wrapped ) {
					updateWrapped( parentItem, parentItem.wrapped );
				}
				// Rebuild, without creating a new template item
				return jQuery( build( parentItem, null, parentItem.tmpl( jQuery, parentItem ) ));
			}
			if ( !tmpl ) {
				return []; // Could throw...
			}
			if ( typeof data === "function" ) {
				data = data.call( parentItem || {} );
			}
			if ( options && options.wrapped ) {
				updateWrapped( options, options.wrapped );
			}
			ret = jQuery.isArray( data ) ?
				jQuery.map( data, function( dataItem ) {
					return dataItem ? newTmplItem( options, parentItem, tmpl, dataItem ) : null;
				}) :
				[ newTmplItem( options, parentItem, tmpl, data ) ];
			return topLevel ? jQuery( build( parentItem, null, ret ) ) : ret;
		},

		// Return rendered template item for an element.
		tmplItem: function( elem ) {
			var tmplItem;
			if ( elem instanceof jQuery ) {
				elem = elem[0];
			}
			while ( elem && elem.nodeType === 1 && !(tmplItem = jQuery.data( elem, "tmplItem" )) && (elem = elem.parentNode) ) {}
			return tmplItem || topTmplItem;
		},

		// Set:
		// Use $.template( name, tmpl ) to cache a named template,
		// where tmpl is a template string, a script element or a jQuery instance wrapping a script element, etc.
		// Use $( "selector" ).template( name ) to provide access by name to a script block template declaration.

		// Get:
		// Use $.template( name ) to access a cached template.
		// Also $( selectorToScriptBlock ).template(), or $.template( null, templateString )
		// will return the compiled template, without adding a name reference.
		// If templateString includes at least one HTML tag, $.template( templateString ) is equivalent
		// to $.template( null, templateString )
		template: function( name, tmpl ) {
			if (tmpl) {
				// Compile template and associate with name
				if ( typeof tmpl === "string" ) {
					// This is an HTML string being passed directly in.
					tmpl = buildTmplFn( tmpl );
				} else if ( tmpl instanceof jQuery ) {
					tmpl = tmpl[0] || {};
				}
				if ( tmpl.nodeType ) {
					// If this is a template block, use cached copy, or generate tmpl function and cache.
					tmpl = jQuery.data( tmpl, "tmpl" ) || jQuery.data( tmpl, "tmpl", buildTmplFn( tmpl.innerHTML ));
					// Issue: In IE, if the container element is not a script block, the innerHTML will remove quotes from attribute values whenever the value does not include white space.
					// This means that foo="${x}" will not work if the value of x includes white space: foo="${x}" -> foo=value of x.
					// To correct this, include space in tag: foo="${ x }" -> foo="value of x"
				}
				return typeof name === "string" ? (jQuery.template[name] = tmpl) : tmpl;
			}
			// Return named compiled template
			return name ? (typeof name !== "string" ? jQuery.template( null, name ):
				(jQuery.template[name] ||
					// If not in map, and not containing at least on HTML tag, treat as a selector.
					// (If integrated with core, use quickExpr.exec)
					jQuery.template( null, htmlExpr.test( name ) ? name : jQuery( name )))) : null;
		},

		encode: function( text ) {
			// Do HTML encoding replacing < > & and ' and " by corresponding entities.
			return ("" + text).split("<").join("&lt;").split(">").join("&gt;").split('"').join("&#34;").split("'").join("&#39;");
		}
	});

	jQuery.extend( jQuery.tmpl, {
		tag: {
			"tmpl": {
				_default: { $2: "null" },
				open: "if($notnull_1){__=__.concat($item.nest($1,$2));}"
				// tmpl target parameter can be of type function, so use $1, not $1a (so not auto detection of functions)
				// This means that {{tmpl foo}} treats foo as a template (which IS a function).
				// Explicit parens can be used if foo is a function that returns a template: {{tmpl foo()}}.
			},
			"wrap": {
				_default: { $2: "null" },
				open: "$item.calls(__,$1,$2);__=[];",
				close: "call=$item.calls();__=call._.concat($item.wrap(call,__));"
			},
			"each": {
				_default: { $2: "$index, $value" },
				open: "if($notnull_1){$.each($1a,function($2){with(this){",
				close: "}});}"
			},
			"if": {
				open: "if(($notnull_1) && $1a){",
				close: "}"
			},
			"else": {
				_default: { $1: "true" },
				open: "}else if(($notnull_1) && $1a){"
			},
			"html": {
				// Unecoded expression evaluation.
				open: "if($notnull_1){__.push($1a);}"
			},
			"=": {
				// Encoded expression evaluation. Abbreviated form is ${}.
				_default: { $1: "$data" },
				open: "if($notnull_1){__.push($.encode($1a));}"
			},
			"!": {
				// Comment tag. Skipped by parser
				open: ""
			}
		},

		// This stub can be overridden, e.g. in jquery.tmplPlus for providing rendered events
		complete: function( items ) {
			newTmplItems = {};
		},

		// Call this from code which overrides domManip, or equivalent
		// Manage cloning/storing template items etc.
		afterManip: function afterManip( elem, fragClone, callback ) {
			// Provides cloned fragment ready for fixup prior to and after insertion into DOM
			var content = fragClone.nodeType === 11 ?
				jQuery.makeArray(fragClone.childNodes) :
				fragClone.nodeType === 1 ? [fragClone] : [];

			// Return fragment to original caller (e.g. append) for DOM insertion
			callback.call( elem, fragClone );

			// Fragment has been inserted:- Add inserted nodes to tmplItem data structure. Replace inserted element annotations by jQuery.data.
			storeTmplItems( content );
			cloneIndex++;
		}
	});

	//========================== Private helper functions, used by code above ==========================

	function build( tmplItem, nested, content ) {
		// Convert hierarchical content into flat string array
		// and finally return array of fragments ready for DOM insertion
		var frag, ret = content ? jQuery.map( content, function( item ) {
			return (typeof item === "string") ?
				// Insert template item annotations, to be converted to jQuery.data( "tmplItem" ) when elems are inserted into DOM.
				(tmplItem.key ? item.replace( /(<\w+)(?=[\s>])(?![^>]*_tmplitem)([^>]*)/g, "$1 " + tmplItmAtt + "=\"" + tmplItem.key + "\" $2" ) : item) :
				// This is a child template item. Build nested template.
				build( item, tmplItem, item._ctnt );
		}) :
		// If content is not defined, insert tmplItem directly. Not a template item. May be a string, or a string array, e.g. from {{html $item.html()}}.
		tmplItem;
		if ( nested ) {
			return ret;
		}

		// top-level template
		ret = ret.join("");

		// Support templates which have initial or final text nodes, or consist only of text
		// Also support HTML entities within the HTML markup.
		ret.replace( /^\s*([^<\s][^<]*)?(<[\w\W]+>)([^>]*[^>\s])?\s*$/, function( all, before, middle, after) {
			frag = jQuery( middle ).get();

			storeTmplItems( frag );
			if ( before ) {
				frag = unencode( before ).concat(frag);
			}
			if ( after ) {
				frag = frag.concat(unencode( after ));
			}
		});
		return frag ? frag : unencode( ret );
	}

	function unencode( text ) {
		// Use createElement, since createTextNode will not render HTML entities correctly
		var el = document.createElement( "div" );
		el.innerHTML = text;
		return jQuery.makeArray(el.childNodes);
	}

	// Generate a reusable function that will serve to render a template against data
	function buildTmplFn( markup ) {
		return new Function("jQuery","$item",
			// Use the variable __ to hold a string array while building the compiled template. (See https://github.com/jquery/jquery-tmpl/issues#issue/10).
			"var $=jQuery,call,__=[],$data=$item.data;" +

			// Introduce the data as local variables using with(){}
			"with($data){__.push('" +

			// Convert the template into pure JavaScript
			jQuery.trim(markup)
				.replace( /([\\'])/g, "\\$1" )
				.replace( /[\r\t\n]/g, " " )
				.replace( /\$\{([^\}]*)\}/g, "{{= $1}}" )
				.replace( /\{\{(\/?)(\w+|.)(?:\(((?:[^\}]|\}(?!\}))*?)?\))?(?:\s+(.*?)?)?(\(((?:[^\}]|\}(?!\}))*?)\))?\s*\}\}/g,
				function( all, slash, type, fnargs, target, parens, args ) {
					var tag = jQuery.tmpl.tag[ type ], def, expr, exprAutoFnDetect;
					if ( !tag ) {
						throw "Unknown template tag: " + type;
					}
					def = tag._default || [];
					if ( parens && !/\w$/.test(target)) {
						target += parens;
						parens = "";
					}
					if ( target ) {
						target = unescape( target );
						args = args ? ("," + unescape( args ) + ")") : (parens ? ")" : "");
						// Support for target being things like a.toLowerCase();
						// In that case don't call with template item as 'this' pointer. Just evaluate...
						expr = parens ? (target.indexOf(".") > -1 ? target + unescape( parens ) : ("(" + target + ").call($item" + args)) : target;
						exprAutoFnDetect = parens ? expr : "(typeof(" + target + ")==='function'?(" + target + ").call($item):(" + target + "))";
					} else {
						exprAutoFnDetect = expr = def.$1 || "null";
					}
					fnargs = unescape( fnargs );
					return "');" +
						tag[ slash ? "close" : "open" ]
							.split( "$notnull_1" ).join( target ? "typeof(" + target + ")!=='undefined' && (" + target + ")!=null" : "true" )
							.split( "$1a" ).join( exprAutoFnDetect )
							.split( "$1" ).join( expr )
							.split( "$2" ).join( fnargs || def.$2 || "" ) +
						"__.push('";
				}) +
			"');}return __;"
		);
	}
	function updateWrapped( options, wrapped ) {
		// Build the wrapped content.
		options._wrap = build( options, true,
			// Suport imperative scenario in which options.wrapped can be set to a selector or an HTML string.
			jQuery.isArray( wrapped ) ? wrapped : [htmlExpr.test( wrapped ) ? wrapped : jQuery( wrapped ).html()]
		).join("");
	}

	function unescape( args ) {
		return args ? args.replace( /\\'/g, "'").replace(/\\\\/g, "\\" ) : null;
	}
	function outerHtml( elem ) {
		var div = document.createElement("div");
		div.appendChild( elem.cloneNode(true) );
		return div.innerHTML;
	}

	// Store template items in jQuery.data(), ensuring a unique tmplItem data data structure for each rendered template instance.
	function storeTmplItems( content ) {
		var keySuffix = "_" + cloneIndex, elem, elems, newClonedItems = {}, i, l, m;
		for ( i = 0, l = content.length; i < l; i++ ) {
			if ( (elem = content[i]).nodeType !== 1 ) {
				continue;
			}
			elems = elem.getElementsByTagName("*");
			for ( m = elems.length - 1; m >= 0; m-- ) {
				processItemKey( elems[m] );
			}
			processItemKey( elem );
		}
		function processItemKey( el ) {
			var pntKey, pntNode = el, pntItem, tmplItem, key;
			// Ensure that each rendered template inserted into the DOM has its own template item,
			if ( (key = el.getAttribute( tmplItmAtt ))) {
				while ( pntNode.parentNode && (pntNode = pntNode.parentNode).nodeType === 1 && !(pntKey = pntNode.getAttribute( tmplItmAtt ))) { }
				if ( pntKey !== key ) {
					// The next ancestor with a _tmplitem expando is on a different key than this one.
					// So this is a top-level element within this template item
					// Set pntNode to the key of the parentNode, or to 0 if pntNode.parentNode is null, or pntNode is a fragment.
					pntNode = pntNode.parentNode ? (pntNode.nodeType === 11 ? 0 : (pntNode.getAttribute( tmplItmAtt ) || 0)) : 0;
					if ( !(tmplItem = newTmplItems[key]) ) {
						// The item is for wrapped content, and was copied from the temporary parent wrappedItem.
						tmplItem = wrappedItems[key];
						tmplItem = newTmplItem( tmplItem, newTmplItems[pntNode]||wrappedItems[pntNode] );
						tmplItem.key = ++itemKey;
						newTmplItems[itemKey] = tmplItem;
					}
					if ( cloneIndex ) {
						cloneTmplItem( key );
					}
				}
				el.removeAttribute( tmplItmAtt );
			} else if ( cloneIndex && (tmplItem = jQuery.data( el, "tmplItem" )) ) {
				// This was a rendered element, cloned during append or appendTo etc.
				// TmplItem stored in jQuery data has already been cloned in cloneCopyEvent. We must replace it with a fresh cloned tmplItem.
				cloneTmplItem( tmplItem.key );
				newTmplItems[tmplItem.key] = tmplItem;
				pntNode = jQuery.data( el.parentNode, "tmplItem" );
				pntNode = pntNode ? pntNode.key : 0;
			}
			if ( tmplItem ) {
				pntItem = tmplItem;
				// Find the template item of the parent element.
				// (Using !=, not !==, since pntItem.key is number, and pntNode may be a string)
				while ( pntItem && pntItem.key != pntNode ) {
					// Add this element as a top-level node for this rendered template item, as well as for any
					// ancestor items between this item and the item of its parent element
					pntItem.nodes.push( el );
					pntItem = pntItem.parent;
				}
				// Delete content built during rendering - reduce API surface area and memory use, and avoid exposing of stale data after rendering...
				delete tmplItem._ctnt;
				delete tmplItem._wrap;
				// Store template item as jQuery data on the element
				jQuery.data( el, "tmplItem", tmplItem );
			}
			function cloneTmplItem( key ) {
				key = key + keySuffix;
				tmplItem = newClonedItems[key] =
					(newClonedItems[key] || newTmplItem( tmplItem, newTmplItems[tmplItem.parent.key + keySuffix] || tmplItem.parent ));
			}
		}
	}

	//---- Helper functions for template item ----

	function tiCalls( content, tmpl, data, options ) {
		if ( !content ) {
			return stack.pop();
		}
		stack.push({ _: content, tmpl: tmpl, item:this, data: data, options: options });
	}

	function tiNest( tmpl, data, options ) {
		// nested template, using {{tmpl}} tag
		return jQuery.tmpl( jQuery.template( tmpl ), data, options, this );
	}

	function tiWrap( call, wrapped ) {
		// nested template, using {{wrap}} tag
		var options = call.options || {};
		options.wrapped = wrapped;
		// Apply the template, which may incorporate wrapped content,
		return jQuery.tmpl( jQuery.template( call.tmpl ), call.data, options, call.item );
	}

	function tiHtml( filter, textOnly ) {
		var wrapped = this._wrap;
		return jQuery.map(
			jQuery( jQuery.isArray( wrapped ) ? wrapped.join("") : wrapped ).filter( filter || "*" ),
			function(e) {
				return textOnly ?
					e.innerText || e.textContent :
					e.outerHTML || outerHtml(e);
			});
	}

	function tiUpdate() {
		var coll = this.nodes;
		jQuery.tmpl( null, null, null, this).insertBefore( coll[0] );
		jQuery( coll ).remove();
	}
})( jQuery );
/*!
 * URI.js - Mutating URLs
 *
 * Version: 1.7.2
 *
 * Author: Rodney Rehm
 * Web: http://medialize.github.com/URI.js/
 *
 * Licensed under
 *   MIT License http://www.opensource.org/licenses/mit-license
 *   GPL v3 http://opensource.org/licenses/GPL-3.0
 *
 */


(function(undefined) {

var _use_module = typeof module !== "undefined" && module.exports,
    _load_module = function(module) {
        return _use_module ? require('./' + module) : window[module];
    },
    punycode = _load_module('punycode'),
    IPv6 = _load_module('IPv6'),
    SLD = _load_module('SecondLevelDomains'),
    URI = function(url, base) {
        // Allow instantiation without the 'new' keyword
        if (!(this instanceof URI)) {
            return new URI(url, base);
        }

        if (url === undefined) {
            if (typeof location !== 'undefined') {
                url = location.href + "";
            } else {
                url = "";
            }
        }

        this.href(url);

        // resolve to base according to http://dvcs.w3.org/hg/url/raw-file/tip/Overview.html#constructor
        if (base !== undefined) {
            return this.absoluteTo(base);
        }

        return this;
    },
    p = URI.prototype;

function escapeRegEx(string) {
    // https://github.com/medialize/URI.js/commit/85ac21783c11f8ccab06106dba9735a31a86924d#commitcomment-821963
    return string.replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
}

function isArray(obj) {
    return String(Object.prototype.toString.call(obj)) === "[object Array]";
}

function filterArrayValues(data, value) {
    var lookup = {},
        i, length;

    if (isArray(value)) {
        for (i = 0, length = value.length; i < length; i++) {
            lookup[value[i]] = true;
        }
    } else {
        lookup[value] = true;
    }

    for (i = 0, length = data.length; i < length; i++) {
        if (lookup[data[i]] !== undefined) {
            data.splice(i, 1);
            length--;
            i--;
        }
    }

    return data;
}

// static properties
URI.idn_expression = /[^a-z0-9\.-]/i;
URI.punycode_expression = /(xn--)/i;
// well, 333.444.555.666 matches, but it sure ain't no IPv4 - do we care?
URI.ip4_expression = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
// credits to Rich Brown
// source: http://forums.intermapper.com/viewtopic.php?p=1096#1096
// specification: http://www.ietf.org/rfc/rfc4291.txt
URI.ip6_expression = /^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/ ;
// gruber revised expression - http://rodneyrehm.de/t/url-regex.html
URI.find_uri_expression = /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/ig;
// http://www.iana.org/assignments/uri-schemes.html
// http://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers#Well-known_ports
URI.defaultPorts = {
    http: "80",
    https: "443",
    ftp: "21"
};
// allowed hostname characters according to RFC 3986
// ALPHA DIGIT "-" "." "_" "~" "!" "$" "&" "'" "(" ")" "*" "+" "," ";" "=" %encoded
// I've never seen a (non-IDN) hostname other than: ALPHA DIGIT . -
URI.invalid_hostname_characters = /[^a-zA-Z0-9\.-]/;
// encoding / decoding according to RFC3986
function strictEncodeURIComponent(string) {
    // see https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/encodeURIComponent
    return encodeURIComponent(string).replace(/[!'()*]/g, escape);
}
URI.encode = strictEncodeURIComponent;
URI.decode = decodeURIComponent;
URI.iso8859 = function() {
    URI.encode = escape;
    URI.decode = unescape;
};
URI.unicode = function() {
    URI.encode = strictEncodeURIComponent;
    URI.decode = decodeURIComponent;
};
URI.characters = {
    pathname: {
        encode: {
            // RFC3986 2.1: For consistency, URI producers and normalizers should
            // use uppercase hexadecimal digits for all percent-encodings.
            expression: /%(24|26|2B|2C|3B|3D|3A|40)/ig,
            map: {
                // -._~!'()*
                "%24": "$",
                "%26": "&",
                "%2B": "+",
                "%2C": ",",
                "%3B": ";",
                "%3D": "=",
                "%3A": ":",
                "%40": "@"
            }
        },
        decode: {
            expression: /[\/\?#]/g,
            map: {
                "/": "%2F",
                "?": "%3F",
                "#": "%23"
            }
        }
    },
    reserved: {
        encode: {
            // RFC3986 2.1: For consistency, URI producers and normalizers should
            // use uppercase hexadecimal digits for all percent-encodings.
            expression: /%(21|23|24|26|27|28|29|2A|2B|2C|2F|3A|3B|3D|3F|40|5B|5D)/ig,
            map: {
                // gen-delims
                "%3A": ":",
                "%2F": "/",
                "%3F": "?",
                "%23": "#",
                "%5B": "[",
                "%5D": "]",
                "%40": "@",
                // sub-delims
                "%21": "!",
                "%24": "$",
                "%26": "&",
                "%27": "'",
                "%28": "(",
                "%29": ")",
                "%2A": "*",
                "%2B": "+",
                "%2C": ",",
                "%3B": ";",
                "%3D": "="
            }
        }
    }
};
URI.encodeQuery = function(string) {
    return URI.encode(string + "").replace(/%20/g, '+');
};
URI.decodeQuery = function(string) {
    return URI.decode((string + "").replace(/\+/g, '%20'));
};
URI.recodePath = function(string) {
    var segments = (string + "").split('/');
    for (var i = 0, length = segments.length; i < length; i++) {
        segments[i] = URI.encodePathSegment(URI.decode(segments[i]));
    }

    return segments.join('/');
};
URI.decodePath = function(string) {
    var segments = (string + "").split('/');
    for (var i = 0, length = segments.length; i < length; i++) {
        segments[i] = URI.decodePathSegment(segments[i]);
    }

    return segments.join('/');
};
// generate encode/decode path functions
var _parts = {'encode':'encode', 'decode':'decode'},
    _part,
    generateAccessor = function(_group, _part){
        return function(string) {
            return URI[_part](string + "").replace(URI.characters[_group][_part].expression, function(c) {
                return URI.characters[_group][_part].map[c];
            });
        };
    };

for (_part in _parts) {
    URI[_part + "PathSegment"] = generateAccessor("pathname", _parts[_part]);
}

URI.encodeReserved = generateAccessor("reserved", "encode");

URI.parse = function(string) {
    var pos, t, parts = {};
    // [protocol"://"[username[":"password]"@"]hostname[":"port]"/"?][path]["?"querystring]["#"fragment]

    // extract fragment
    pos = string.indexOf('#');
    if (pos > -1) {
        // escaping?
        parts.fragment = string.substring(pos + 1) || null;
        string = string.substring(0, pos);
    }

    // extract query
    pos = string.indexOf('?');
    if (pos > -1) {
        // escaping?
        parts.query = string.substring(pos + 1) || null;
        string = string.substring(0, pos);
    }

    // extract protocol
    if (string.substring(0, 2) === '//') {
        // relative-scheme
        parts.protocol = '';
        string = string.substring(2);
        // extract "user:pass@host:port"
        string = URI.parseAuthority(string, parts);
    } else {
        pos = string.indexOf(':');
        if (pos > -1) {
            parts.protocol = string.substring(0, pos);
            if (string.substring(pos + 1, pos + 3) === '//') {
                string = string.substring(pos + 3);

                // extract "user:pass@host:port"
                string = URI.parseAuthority(string, parts);
            } else {
                string = string.substring(pos + 1);
                parts.urn = true;
            }
        }
    }

    // what's left must be the path
    parts.path = string;

    // and we're done
    return parts;
};
URI.parseHost = function(string, parts) {
    // extract host:port
    var pos = string.indexOf('/'),
        t;

    if (pos === -1) {
        pos = string.length;
    }

    if (string[0] === "[") {
        // IPv6 host - http://tools.ietf.org/html/draft-ietf-6man-text-addr-representation-04#section-6
        // I claim most client software breaks on IPv6 anyways. To simplify things, URI only accepts
        // IPv6+port in the format [2001:db8::1]:80 (for the time being)
        var bracketPos = string.indexOf(']');
        parts.hostname = string.substring(1, bracketPos) || null;
        parts.port = string.substring(bracketPos+2, pos) || null;
    } else if (string.indexOf(':') !== string.lastIndexOf(':')) {
        // IPv6 host contains multiple colons - but no port
        // this notation is actually not allowed by RFC 3986, but we're a liberal parser
        parts.hostname = string.substring(0, pos) || null;
        parts.port = null;
    } else {
        t = string.substring(0, pos).split(':');
        parts.hostname = t[0] || null;
        parts.port = t[1] || null;
    }

    if (parts.hostname && string.substring(pos)[0] !== '/') {
        pos++;
        string = "/" + string;
    }

    return string.substring(pos) || '/';
};
URI.parseAuthority = function(string, parts) {
    string = URI.parseUserinfo(string, parts);
    return URI.parseHost(string, parts);
};
URI.parseUserinfo = function(string, parts) {
    // extract username:password
    var pos = string.indexOf('@'),
        firstSlash = string.indexOf('/'),
        t;

    // authority@ must come before /path
    if (pos > -1 && (firstSlash === -1 || pos < firstSlash)) {
        t = string.substring(0, pos).split(':');
        parts.username = t[0] ? URI.decode(t[0]) : null;
        parts.password = t[1] ? URI.decode(t[1]) : null;
        string = string.substring(pos + 1);
    } else {
        parts.username = null;
        parts.password = null;
    }

    return string;
};
URI.parseQuery = function(string) {
    if (!string) {
        return {};
    }

    // throw out the funky business - "?"[name"="value"&"]+
    string = string.replace(/&+/g, '&').replace(/^\?*&*|&+$/g, '');

    if (!string) {
        return {};
    }

    var items = {},
        splits = string.split('&'),
        length = splits.length;

    for (var i = 0; i < length; i++) {
        var v = splits[i].split('='),
            name = URI.decodeQuery(v.shift()),
            // no "=" is null according to http://dvcs.w3.org/hg/url/raw-file/tip/Overview.html#collect-url-parameters
            value = v.length ? URI.decodeQuery(v.join('=')) : null;

        if (items[name]) {
            if (typeof items[name] === "string") {
                items[name] = [items[name]];
            }

            items[name].push(value);
        } else {
            items[name] = value;
        }
    }

    return items;
};

URI.build = function(parts) {
    var t = '';

    if (parts.protocol) {
        t += parts.protocol + ":";
    }

    if (!parts.urn && (t || parts.hostname)) {
        t += '//';
    }

    t += (URI.buildAuthority(parts) || '');

    if (typeof parts.path === "string") {
        if (parts.path[0] !== '/' && typeof parts.hostname === "string") {
            t += '/';
        }

        t += parts.path;
    }

    if (typeof parts.query === "string") {
        t += '?' + parts.query;
    }

    if (typeof parts.fragment === "string") {
        t += '#' + parts.fragment;
    }
    return t;
};
URI.buildHost = function(parts) {
    var t = '';

    if (!parts.hostname) {
        return '';
    } else if (URI.ip6_expression.test(parts.hostname)) {
        if (parts.port) {
            t += "[" + parts.hostname + "]:" + parts.port;
        } else {
            // don't know if we should always wrap IPv6 in []
            // the RFC explicitly says SHOULD, not MUST.
            t += parts.hostname;
        }
    } else {
        t += parts.hostname;
        if (parts.port) {
            t += ':' + parts.port;
        }
    }

    return t;
};
URI.buildAuthority = function(parts) {
    return URI.buildUserinfo(parts) + URI.buildHost(parts);
};
URI.buildUserinfo = function(parts) {
    var t = '';

    if (parts.username) {
        t += URI.encode(parts.username);

        if (parts.password) {
            t += ':' + URI.encode(parts.password);
        }

        t += "@";
    }

    return t;
};
URI.buildQuery = function(data, duplicates) {
    // according to http://tools.ietf.org/html/rfc3986 or http://labs.apache.org/webarch/uri/rfc/rfc3986.html
    // being »-._~!$&'()*+,;=:@/?« %HEX and alnum are allowed
    // the RFC explicitly states ?/foo being a valid use case, no mention of parameter syntax!
    // URI.js treats the query string as being application/x-www-form-urlencoded
    // see http://www.w3.org/TR/REC-html40/interact/forms.html#form-content-type

    var t = "";
    for (var key in data) {
        if (Object.hasOwnProperty.call(data, key) && key) {
            if (isArray(data[key])) {
                var unique = {};
                for (var i = 0, length = data[key].length; i < length; i++) {
                    if (data[key][i] !== undefined && unique[data[key][i] + ""] === undefined) {
                        t += "&" + URI.buildQueryParameter(key, data[key][i]);
                        if (duplicates !== true) {
                            unique[data[key][i] + ""] = true;
                        }
                    }
                }
            } else if (data[key] !== undefined) {
                t += '&' + URI.buildQueryParameter(key, data[key]);
            }
        }
    }

    return t.substring(1);
};
URI.buildQueryParameter = function(name, value) {
    // http://www.w3.org/TR/REC-html40/interact/forms.html#form-content-type -- application/x-www-form-urlencoded
    // don't append "=" for null values, according to http://dvcs.w3.org/hg/url/raw-file/tip/Overview.html#url-parameter-serialization
    return URI.encodeQuery(name) + (value !== null ? "=" + URI.encodeQuery(value) : "");
};

URI.addQuery = function(data, name, value) {
    if (typeof name === "object") {
        for (var key in name) {
            if (Object.prototype.hasOwnProperty.call(name, key)) {
                URI.addQuery(data, key, name[key]);
            }
        }
    } else if (typeof name === "string") {
        if (data[name] === undefined) {
            data[name] = value;
            return;
        } else if (typeof data[name] === "string") {
            data[name] = [data[name]];
        }

        if (!isArray(value)) {
            value = [value];
        }

        data[name] = data[name].concat(value);
    } else {
        throw new TypeError("URI.addQuery() accepts an object, string as the name parameter");
    }
};
URI.removeQuery = function(data, name, value) {
    if (isArray(name)) {
        for (var i = 0, length = name.length; i < length; i++) {
            data[name[i]] = undefined;
        }
    } else if (typeof name === "object") {
        for (var key in name) {
            if (Object.prototype.hasOwnProperty.call(name, key)) {
                URI.removeQuery(data, key, name[key]);
            }
        }
    } else if (typeof name === "string") {
        if (value !== undefined) {
            if (data[name] === value) {
                data[name] = undefined;
            } else if (isArray(data[name])) {
                data[name] = filterArrayValues(data[name], value);
            }
        } else {
            data[name] = undefined;
        }
    } else {
        throw new TypeError("URI.addQuery() accepts an object, string as the first parameter");
    }
};

URI.commonPath = function(one, two) {
    var length = Math.min(one.length, two.length),
        pos;

    // find first non-matching character
    for (pos = 0; pos < length; pos++) {
        if (one[pos] !== two[pos]) {
            pos--;
            break;
        }
    }

    if (pos < 1) {
        return one[0] === two[0] && one[0] === '/' ? '/' : '';
    }

    // revert to last /
    if (one[pos] !== '/') {
        pos = one.substring(0, pos).lastIndexOf('/');
    }

    return one.substring(0, pos + 1);
};

URI.withinString = function(string, callback) {
    // expression used is "gruber revised" (@gruber v2) determined to be the best solution in
    // a regex sprint we did a couple of ages ago at
    // * http://mathiasbynens.be/demo/url-regex
    // * http://rodneyrehm.de/t/url-regex.html

    return string.replace(URI.find_uri_expression, callback);
};

URI.ensureValidHostname = function(v) {
    // Theoretically URIs allow percent-encoding in Hostnames (according to RFC 3986)
    // they are not part of DNS and therefore ignored by URI.js

    if (v.match(URI.invalid_hostname_characters)) {
        // test punycode
        if (!punycode) {
            throw new TypeError("Hostname '" + v + "' contains characters other than [A-Z0-9.-] and Punycode.js is not available");
        }

        if (punycode.toASCII(v).match(URI.invalid_hostname_characters)) {
            throw new TypeError("Hostname '" + v + "' contains characters other than [A-Z0-9.-]");
        }
    }
};

p.build = function(deferBuild) {
    if (deferBuild === true) {
        this._deferred_build = true;
    } else if (deferBuild === undefined || this._deferred_build) {
        this._string = URI.build(this._parts);
        this._deferred_build = false;
    }

    return this;
};

p.clone = function() {
    return new URI(this);
};

p.toString = function() {
    return this.build(false)._string;
};
p.valueOf = function() {
    return this.toString();
};

// generate simple accessors
_parts = {protocol: 'protocol', username: 'username', password: 'password', hostname: 'hostname',  port: 'port'};
generateAccessor = function(_part){
    return function(v, build) {
        if (v === undefined) {
            return this._parts[_part] || "";
        } else {
            this._parts[_part] = v;
            this.build(!build);
            return this;
        }
    };
};

for (_part in _parts) {
    p[_part] = generateAccessor(_parts[_part]);
}

// generate accessors with optionally prefixed input
_parts = {query: '?', fragment: '#'};
generateAccessor = function(_part, _key){
    return function(v, build) {
        if (v === undefined) {
            return this._parts[_part] || "";
        } else {
            if (v !== null) {
                v = v + "";
                if (v[0] === _key) {
                    v = v.substring(1);
                }
            }

            this._parts[_part] = v;
            this.build(!build);
            return this;
        }
    };
};

for (_part in _parts) {
    p[_part] = generateAccessor(_part, _parts[_part]);
}

// generate accessors with prefixed output
_parts = {search: ['?', 'query'], hash: ['#', 'fragment']};
generateAccessor = function(_part, _key){
    return function(v, build) {
        var t = this[_part](v, build);
        return typeof t === "string" && t.length ? (_key + t) : t;
    };
};

for (_part in _parts) {
    p[_part] = generateAccessor(_parts[_part][1], _parts[_part][0]);
}

p.pathname = function(v, build) {
    if (v === undefined || v === true) {
        var res = this._parts.path || (this._parts.urn ? '' : '/');
        return v ? URI.decodePath(res) : res;
    } else {
        this._parts.path = v ? URI.recodePath(v) : "/";
        this.build(!build);
        return this;
    }
};
p.path = p.pathname;
p.href = function(href, build) {
    if (href === undefined) {
        return this.toString();
    } else {
        this._string = "";
        this._parts = {
            protocol: null,
            username: null,
            password: null,
            hostname: null,
            urn: null,
            port: null,
            path: null,
            query: null,
            fragment: null
        };

        var _URI = href instanceof URI,
            _object = typeof href === "object" && (href.hostname || href.path),
            key;

        if (typeof href === "string") {
            this._parts = URI.parse(href);
        } else if (_URI || _object) {
            var src = _URI ? href._parts : href;
            for (key in src) {
                if (Object.hasOwnProperty.call(this._parts, key)) {
                    this._parts[key] = src[key];
                }
            }
        } else {
            throw new TypeError("invalid input");
        }

        this.build(!build);
        return this;
    }
};

// identification accessors
p.is = function(what) {
    var ip = false,
        ip4 = false,
        ip6 = false,
        name = false,
        sld = false,
        idn = false,
        punycode = false,
        relative = !this._parts.urn;

    if (this._parts.hostname) {
        relative = false;
        ip4 = URI.ip4_expression.test(this._parts.hostname);
        ip6 = URI.ip6_expression.test(this._parts.hostname);
        ip = ip4 || ip6;
        name = !ip;
        sld = name && SLD && SLD.has(this._parts.hostname);
        idn = name && URI.idn_expression.test(this._parts.hostname);
        punycode = name && URI.punycode_expression.test(this._parts.hostname);
    }

    switch (what.toLowerCase()) {
        case 'relative':
            return relative;

        case 'absolute':
            return !relative;

        // hostname identification
        case 'domain':
        case 'name':
            return name;

        case 'sld':
            return sld;

        case 'ip':
            return ip;

        case 'ip4':
        case 'ipv4':
        case 'inet4':
            return ip4;

        case 'ip6':
        case 'ipv6':
        case 'inet6':
            return ip6;

        case 'idn':
            return idn;

        case 'url':
            return !this._parts.urn;

        case 'urn':
            return !!this._parts.urn;

        case 'punycode':
            return punycode;
    }

    return null;
};

// component specific input validation
var _protocol = p.protocol,
    _port = p.port,
    _hostname = p.hostname;

p.protocol = function(v, build) {
    if (v !== undefined) {
        if (v) {
            // accept trailing ://
            v = v.replace(/:(\/\/)?$/, '');

            if (v.match(/[^a-zA-z0-9\.+-]/)) {
                throw new TypeError("Protocol '" + v + "' contains characters other than [A-Z0-9.+-]");
            }
        }
    }
    return _protocol.call(this, v, build);
};
p.scheme = p.protocol;
p.port = function(v, build) {
    if (this._parts.urn) {
        return v === undefined ? '' : this;
    }

    if (v !== undefined) {
        if (v === 0) {
            v = null;
        }

        if (v) {
            v += "";
            if (v[0] === ":") {
                v = v.substring(1);
            }

            if (v.match(/[^0-9]/)) {
                throw new TypeError("Port '" + v + "' contains characters other than [0-9]");
            }
        }
    }
    return _port.call(this, v, build);
};
p.hostname = function(v, build) {
    if (this._parts.urn) {
        return v === undefined ? '' : this;
    }

    if (v !== undefined) {
        var x = {};
        URI.parseHost(v, x);
        v = x.hostname;
    }
    return _hostname.call(this, v, build);
};

// combination accessors
p.host = function(v, build) {
    if (this._parts.urn) {
        return v === undefined ? '' : this;
    }

    if (v === undefined) {
        return this._parts.hostname ? URI.buildHost(this._parts) : "";
    } else {
        URI.parseHost(v, this._parts);
        this.build(!build);
        return this;
    }
};
p.authority = function(v, build) {
    if (this._parts.urn) {
        return v === undefined ? '' : this;
    }

    if (v === undefined) {
        return this._parts.hostname ? URI.buildAuthority(this._parts) : "";
    } else {
        URI.parseAuthority(v, this._parts);
        this.build(!build);
        return this;
    }
};
p.userinfo = function(v, build) {
    if (this._parts.urn) {
        return v === undefined ? '' : this;
    }

    if (v === undefined) {
        if (!this._parts.username) {
            return "";
        }

        var t = URI.buildUserinfo(this._parts);
        return t.substring(0, t.length -1);
    } else {
        if (v[v.length-1] !== '@') {
            v += '@';
        }

        URI.parseUserinfo(v, this._parts);
        this.build(!build);
        return this;
    }
};

// fraction accessors
p.subdomain = function(v, build) {
    if (this._parts.urn) {
        return v === undefined ? '' : this;
    }

    // convenience, return "www" from "www.example.org"
    if (v === undefined) {
        if (!this._parts.hostname || this.is('IP')) {
            return "";
        }

        // grab domain and add another segment
        var end = this._parts.hostname.length - this.domain().length - 1;
        return this._parts.hostname.substring(0, end) || "";
    } else {
        var e = this._parts.hostname.length - this.domain().length,
            sub = this._parts.hostname.substring(0, e),
            replace = new RegExp('^' + escapeRegEx(sub));

        if (v && v[v.length - 1] !== '.') {
            v += ".";
        }

        if (v) {
            URI.ensureValidHostname(v);
        }

        this._parts.hostname = this._parts.hostname.replace(replace, v);
        this.build(!build);
        return this;
    }
};
p.domain = function(v, build) {
    if (this._parts.urn) {
        return v === undefined ? '' : this;
    }

    if (typeof v === 'boolean') {
        build = v;
        v = undefined;
    }

    // convenience, return "example.org" from "www.example.org"
    if (v === undefined) {
        if (!this._parts.hostname || this.is('IP')) {
            return "";
        }

        // if hostname consists of 1 or 2 segments, it must be the domain
        var t = this._parts.hostname.match(/\./g);
        if (t && t.length < 2) {
            return this._parts.hostname;
        }

        // grab tld and add another segment
        var end = this._parts.hostname.length - this.tld(build).length - 1;
        end = this._parts.hostname.lastIndexOf('.', end -1) + 1;
        return this._parts.hostname.substring(end) || "";
    } else {
        if (!v) {
            throw new TypeError("cannot set domain empty");
        }

        URI.ensureValidHostname(v);

        if (!this._parts.hostname || this.is('IP')) {
            this._parts.hostname = v;
        } else {
            var replace = new RegExp(escapeRegEx(this.domain()) + "$");
            this._parts.hostname = this._parts.hostname.replace(replace, v);
        }

        this.build(!build);
        return this;
    }
};
p.tld = function(v, build) {
    if (this._parts.urn) {
        return v === undefined ? '' : this;
    }

    if (typeof v === 'boolean') {
        build = v;
        v = undefined;
    }

    // return "org" from "www.example.org"
    if (v === undefined) {
        if (!this._parts.hostname || this.is('IP')) {
            return "";
        }

        var pos = this._parts.hostname.lastIndexOf('.'),
            tld = this._parts.hostname.substring(pos + 1);

        if (build !== true && SLD && SLD.list[tld.toLowerCase()]) {
            return SLD.get(this._parts.hostname) || tld;
        }

        return tld;
    } else {
        var replace;
        if (!v) {
            throw new TypeError("cannot set TLD empty");
        } else if (v.match(/[^a-zA-Z0-9-]/)) {
            if (SLD && SLD.is(v)) {
                replace = new RegExp(escapeRegEx(this.tld()) + "$");
                this._parts.hostname = this._parts.hostname.replace(replace, v);
            } else {
                throw new TypeError("TLD '" + v + "' contains characters other than [A-Z0-9]");
            }
        } else if (!this._parts.hostname || this.is('IP')) {
            throw new ReferenceError("cannot set TLD on non-domain host");
        } else {
            replace = new RegExp(escapeRegEx(this.tld()) + "$");
            this._parts.hostname = this._parts.hostname.replace(replace, v);
        }

        this.build(!build);
        return this;
    }
};
p.directory = function(v, build) {
    if (this._parts.urn) {
        return v === undefined ? '' : this;
    }

    if (v === undefined || v === true) {
        if (!this._parts.path && !this._parts.hostname) {
            return '';
        }

        if (this._parts.path === '/') {
            return '/';
        }

        var end = this._parts.path.length - this.filename().length - 1,
            res = this._parts.path.substring(0, end) || (this._parts.hostname ? "/" : "");

        return v ? URI.decodePath(res) : res;

    } else {
        var e = this._parts.path.length - this.filename().length,
            directory = this._parts.path.substring(0, e),
            replace = new RegExp('^' + escapeRegEx(directory));

        // fully qualifier directories begin with a slash
        if (!this.is('relative')) {
            if (!v) {
                v = '/';
            }

            if (v[0] !== '/') {
                v = "/" + v;
            }
        }

        // directories always end with a slash
        if (v && v[v.length - 1] !== '/') {
            v += '/';
        }

        v = URI.recodePath(v);
        this._parts.path = this._parts.path.replace(replace, v);
        this.build(!build);
        return this;
    }
};
p.filename = function(v, build) {
    if (this._parts.urn) {
        return v === undefined ? '' : this;
    }

    if (v === undefined || v === true) {
        if (!this._parts.path || this._parts.path === '/') {
            return "";
        }

        var pos = this._parts.path.lastIndexOf('/'),
            res = this._parts.path.substring(pos+1);

        return v ? URI.decodePathSegment(res) : res;
    } else {
        var mutatedDirectory = false;
        if (v[0] === '/') {
            v = v.substring(1);
        }

        if (v.match(/\.?\//)) {
            mutatedDirectory = true;
        }

        var replace = new RegExp(escapeRegEx(this.filename()) + "$");
        v = URI.recodePath(v);
        this._parts.path = this._parts.path.replace(replace, v);

        if (mutatedDirectory) {
            this.normalizePath(build);
        } else {
            this.build(!build);
        }

        return this;
    }
};
p.suffix = function(v, build) {
    if (this._parts.urn) {
        return v === undefined ? '' : this;
    }

    if (v === undefined || v === true) {
        if (!this._parts.path || this._parts.path === '/') {
            return "";
        }

        var filename = this.filename(),
            pos = filename.lastIndexOf('.'),
            s, res;

        if (pos === -1) {
            return "";
        }

        // suffix may only contain alnum characters (yup, I made this up.)
        s = filename.substring(pos+1);
        res = (/^[a-z0-9%]+$/i).test(s) ? s : "";
        return v ? URI.decodePathSegment(res) : res;
    } else {
        if (v[0] === '.') {
            v = v.substring(1);
        }

        var suffix = this.suffix(),
            replace;

        if (!suffix) {
            if (!v) {
                return this;
            }

            this._parts.path += '.' + URI.recodePath(v);
        } else if (!v) {
            replace = new RegExp(escapeRegEx("." + suffix) + "$");
        } else {
            replace = new RegExp(escapeRegEx(suffix) + "$");
        }

        if (replace) {
            v = URI.recodePath(v);
            this._parts.path = this._parts.path.replace(replace, v);
        }

        this.build(!build);
        return this;
    }
};
p.segment = function(segment, v, build) {
    var separator = this._parts.urn ? ':' : '/',
        path = this.path(),
        absolute = path.substring(0, 1) === '/',
        segments = path.split(separator);

    if (typeof segment !== 'number') {
        build = v;
        v = segment;
        segment = undefined;
    }

    if (segment !== undefined && typeof segment !== 'number') {
        throw new Error("Bad segment '" + segment + "', must be 0-based integer");
    }

    if (absolute) {
        segments.shift();
    }

    if (segment < 0) {
        // allow negative indexes to address from the end
        segment = Math.max(segments.length + segment, 0);
    }

    if (v === undefined) {
        return segment === undefined
            ? segments
            : segments[segment];
    } else if (segment === null || segments[segment] === undefined) {
        if (isArray(v)) {
            segments = v;
        } else if (v || (typeof v === "string" && v.length)) {
            if (segments[segments.length -1] === "") {
                // empty trailing elements have to be overwritten
                // to prefent results such as /foo//bar
                segments[segments.length -1] = v;
            } else {
                segments.push(v);
            }
        }
    } else {
        if (v || (typeof v === "string" && v.length)) {
            segments[segment] = v;
        } else {
            segments.splice(segment, 1);
        }
    }

    if (absolute) {
        segments.unshift("");
    }

    return this.path(segments.join(separator), build);
};

// mutating query string
var q = p.query;
p.query = function(v, build) {
    if (v === true) {
        return URI.parseQuery(this._parts.query);
    } else if (v !== undefined && typeof v !== "string") {
        this._parts.query = URI.buildQuery(v);
        this.build(!build);
        return this;
    } else {
        return q.call(this, v, build);
    }
};
p.addQuery = function(name, value, build) {
    var data = URI.parseQuery(this._parts.query);
    URI.addQuery(data, name, value);
    this._parts.query = URI.buildQuery(data);
    if (typeof name !== "string") {
        build = value;
    }

    this.build(!build);
    return this;
};
p.removeQuery = function(name, value, build) {
    var data = URI.parseQuery(this._parts.query);
    URI.removeQuery(data, name, value);
    this._parts.query = URI.buildQuery(data);
    if (typeof name !== "string") {
        build = value;
    }

    this.build(!build);
    return this;
};
p.addSearch = p.addQuery;
p.removeSearch = p.removeQuery;

// sanitizing URLs
p.normalize = function() {
    if (this._parts.urn) {
        return this
            .normalizeProtocol(false)
            .normalizeQuery(false)
            .normalizeFragment(false)
            .build();
    }

    return this
        .normalizeProtocol(false)
        .normalizeHostname(false)
        .normalizePort(false)
        .normalizePath(false)
        .normalizeQuery(false)
        .normalizeFragment(false)
        .build();
};
p.normalizeProtocol = function(build) {
    if (typeof this._parts.protocol === "string") {
        this._parts.protocol = this._parts.protocol.toLowerCase();
        this.build(!build);
    }

    return this;
};
p.normalizeHostname = function(build) {
    if (this._parts.hostname) {
        if (this.is('IDN') && punycode) {
            this._parts.hostname = punycode.toASCII(this._parts.hostname);
        } else if (this.is('IPv6') && IPv6) {
            this._parts.hostname = IPv6.best(this._parts.hostname);
        }

        this._parts.hostname = this._parts.hostname.toLowerCase();
        this.build(!build);
    }

    return this;
};
p.normalizePort = function(build) {
    // remove port of it's the protocol's default
    if (typeof this._parts.protocol === "string" && this._parts.port === URI.defaultPorts[this._parts.protocol]) {
        this._parts.port = null;
        this.build(!build);
    }

    return this;
};
p.normalizePath = function(build) {
    if (this._parts.urn) {
        return this;
    }

    if (!this._parts.path || this._parts.path === '/') {
        return this;
    }

    var _was_relative,
        _was_relative_prefix,
        _path = this._parts.path,
        _parent, _pos;

    // handle relative paths
    if (_path[0] !== '/') {
        if (_path[0] === '.') {
            _was_relative_prefix = _path.substring(0, _path.indexOf('/'));
        }
        _was_relative = true;
        _path = '/' + _path;
    }
    // resolve simples
    _path = _path.replace(/(\/(\.\/)+)|\/{2,}/g, '/');
    // resolve parents
    while (true) {
        _parent = _path.indexOf('/../');
        if (_parent === -1) {
            // no more ../ to resolve
            break;
        } else if (_parent === 0) {
            // top level cannot be relative...
            _path = _path.substring(3);
            break;
        }

        _pos = _path.substring(0, _parent).lastIndexOf('/');
        if (_pos === -1) {
            _pos = _parent;
        }
        _path = _path.substring(0, _pos) + _path.substring(_parent + 3);
    }
    // revert to relative
    if (_was_relative && this.is('relative')) {
        if (_was_relative_prefix){
            _path = _was_relative_prefix + _path;
        } else {
            _path = _path.substring(1);
        }
    }

    _path = URI.recodePath(_path);
    this._parts.path = _path;
    this.build(!build);
    return this;
};
p.normalizePathname = p.normalizePath;
p.normalizeQuery = function(build) {
    if (typeof this._parts.query === "string") {
        if (!this._parts.query.length) {
            this._parts.query = null;
        } else {
            this.query(URI.parseQuery(this._parts.query));
        }

        this.build(!build);
    }

    return this;
};
p.normalizeFragment = function(build) {
    if (!this._parts.fragment) {
        this._parts.fragment = null;
        this.build(!build);
    }

    return this;
};
p.normalizeSearch = p.normalizeQuery;
p.normalizeHash = p.normalizeFragment;

p.iso8859 = function() {
    // expect unicode input, iso8859 output
    var e = URI.encode,
        d = URI.decode;

    URI.encode = escape;
    URI.decode = decodeURIComponent;
    this.normalize();
    URI.encode = e;
    URI.decode = d;
    return this;
};

p.unicode = function() {
    // expect iso8859 input, unicode output
    var e = URI.encode,
        d = URI.decode;

    URI.encode = strictEncodeURIComponent;
    URI.decode = unescape;
    this.normalize();
    URI.encode = e;
    URI.decode = d;
    return this;
};

p.readable = function() {
    var uri = this.clone();
    // removing username, password, because they shouldn't be displayed according to RFC 3986
    uri.username("").password("").normalize();
    var t = '';
    if (uri._parts.protocol) {
        t += uri._parts.protocol + '://';
    }

    if (uri._parts.hostname) {
        if (uri.is('punycode') && punycode) {
            t += punycode.toUnicode(uri._parts.hostname);
            if (uri._parts.port) {
                t += ":" + uri._parts.port;
            }
        } else {
            t += uri.host();
        }
    }

    if (uri._parts.hostname && uri._parts.path && uri._parts.path[0] !== '/') {
        t += '/';
    }

    t += uri.path(true);
    if (uri._parts.query) {
        var q = '';
        for (var i = 0, qp = uri._parts.query.split('&'), l = qp.length; i < l; i++) {
            var kv = (qp[i] || "").split('=');
            q += '&' + URI.decodeQuery(kv[0])
                .replace(/&/g, '%26');

            if (kv[1] !== undefined) {
                q += "=" + URI.decodeQuery(kv[1])
                    .replace(/&/g, '%26');
            }
        }
        t += '?' + q.substring(1);
    }

    t += uri.hash();
    return t;
};

// resolving relative and absolute URLs
p.absoluteTo = function(base) {
    var resolved = this.clone(),
        properties = ['protocol', 'username', 'password', 'hostname', 'port'],
        basedir, i, p;

    if (this._parts.urn) {
        throw new Error('URNs do not have any generally defined hierachical components');
    }

    if (this._parts.hostname) {
        return resolved;
    }

    if (!(base instanceof URI)) {
        base = new URI(base);
    }

    for (i = 0, p; p = properties[i]; i++) {
        resolved._parts[p] = base._parts[p];
    }
    
    properties = ['query', 'path'];
    for (i = 0, p; p = properties[i]; i++) {
        if (!resolved._parts[p] && base._parts[p]) {
            resolved._parts[p] = base._parts[p];
        }
    }

    if (resolved.path()[0] !== '/') {
        basedir = base.directory();
        resolved._parts.path = (basedir ? (basedir + '/') : '') + resolved._parts.path;
        resolved.normalizePath();
    }

    resolved.build();
    return resolved;
};
p.relativeTo = function(base) {
    var relative = this.clone(),
        properties = ['protocol', 'username', 'password', 'hostname', 'port'],
        common,
        _base;

    if (this._parts.urn) {
        throw new Error('URNs do not have any generally defined hierachical components');
    }

    if (!(base instanceof URI)) {
        base = new URI(base);
    }

    if (this.path()[0] !== '/' || base.path()[0] !== '/') {
        throw new Error('Cannot calculate common path from non-relative URLs');
    }

    common = URI.commonPath(relative.path(), base.path());
    _base = base.directory();

    for (var i = 0, p; p = properties[i]; i++) {
        relative._parts[p] = null;
    }

    if (!common || common === '/') {
        return relative;
    }

    if (_base + '/' === common) {
        relative._parts.path = './' + relative.filename();
    } else {
        var parents = '../',
            _common = new RegExp('^' + escapeRegEx(common)),
            _parents = _base.replace(_common, '/').match(/\//g).length -1;

        while (_parents--) {
            parents += '../';
        }

        relative._parts.path = relative._parts.path.replace(_common, parents);
    }

    relative.build();
    return relative;
};

// comparing URIs
p.equals = function(uri) {
    var one = this.clone(),
        two = new URI(uri),
        one_map = {},
        two_map = {},
        checked = {},
        one_query,
        two_query,
        key;

    one.normalize();
    two.normalize();

    // exact match
    if (one.toString() === two.toString()) {
        return true;
    }

    // extract query string
    one_query = one.query();
    two_query = two.query();
    one.query("");
    two.query("");

    // definitely not equal if not even non-query parts match
    if (one.toString() !== two.toString()) {
        return false;
    }

    // query parameters have the same length, even if they're permutated
    if (one_query.length !== two_query.length) {
        return false;
    }

    one_map = URI.parseQuery(one_query);
    two_map = URI.parseQuery(two_query);

    for (key in one_map) {
        if (Object.prototype.hasOwnProperty.call(one_map, key)) {
            if (!isArray(one_map[key])) {
                if (one_map[key] !== two_map[key]) {
                    return false;
                }
            } else {
                if (!isArray(two_map[key])) {
                    return false;
                }

                // arrays can't be equal if they have different amount of content
                if (one_map[key].length !== two_map[key].length) {
                    return false;
                }

                one_map[key].sort();
                two_map[key].sort();

                for (var i = 0, l = one_map[key].length; i < l; i++) {
                    if (one_map[key][i] !== two_map[key][i]) {
                        return false;
                    }
                }
            }

            checked[key] = true;
        }
    }

    for (key in two_map) {
        if (Object.prototype.hasOwnProperty.call(two_map, key)) {
            if (!checked[key]) {
                // two contains a parameter not present in one
                return false;
            }
        }
    }

    return true;
};

(typeof module !== 'undefined' && module.exports
    ? module.exports = URI
    : window.URI = URI
);

})();
(function() {
  window.AuthorBook = {
    init: function() {
      return $((function(_this) {
        return function() {
          return _this.initBookCRUD();
        };
      })(this));
    },
    initBookCRUD: function() {
      var bindEditOnAttribute;
      bindEditOnAttribute = function(attrName) {
        return $(".j_" + attrName).click(function(e) {
          var dataBook, val;
          val = prompt("Enter new " + attrName + ":");
          dataBook = {};
          dataBook[attrName] = val;
          if (val) {
            return $.ajax({
              url: '/books/1',
              data: {
                book: dataBook
              },
              dataType: 'JSON',
              type: 'PUT',
              success: function(data) {
                return $(".j_" + attrName).html(data[attrName]);
              }
            });
          } else {
            return alert("no text entered, cancelling");
          }
        });
      };
      bindEditOnAttribute("subtitle");
      return bindEditOnAttribute("description");
    }
  };

}).call(this);
(function() {
  window.BookManage = {
    init: function(book, discounts) {
      this.book = book;
      this.discounts = discounts;
      $(".toggleButton").click((function(_this) {
        return function(e) {
          var data, el$, state;
          el$ = $(e.target);
          el$.toggleClass("on");
          el$.toggleClass("off");
          state = el$.hasClass("on") ? "on" : "off";
          el$.html(el$.html().replace(/: (on|off)/, ": " + state));
          data = {
            book: {}
          };
          data.book[el$.attr("id")] = state === "on";
          $.ajax({
            url: "/books/" + _this.book.id,
            data: data,
            dataType: 'JSON',
            type: 'PUT',
            success: function(data) {}
          });
          return false;
        };
      })(this));
      $(".j_editScreencastToggle").click((function(_this) {
        return function(e) {
          var screencast_node;
          screencast_node = $(e.target).closest('.j_screencastItem');
          if ($(screencast_node).hasClass("j_active")) {
            $(screencast_node).removeClass("j_active");
            return e.preventDefault();
          } else {
            $(screencast_node).addClass("j_active");
            return e.preventDefault();
          }
        };
      })(this));
      this.edittingDiscount = false;
      $("#addDiscountBtn").click(function() {
        this.edittingDiscount = true;
        $("#manageDiscountAdd").toggle();
        $(".j_discountFormCreate").show();
        $('html,body').animate({
          scrollTop: $("#manageDiscountAdd").offset().top
        }, 1000);
        return $(".j_discountFormEdit").hide();
      });
      $('#discount_all_options').change(function() {
        $('.j_discountOptionCheckboxes input').attr('disabled', this.checked).attr('checked', false);
        return $(".j_discountOptionCheckboxes .checkLabel").toggleClass('disabled');
      });
      this.discountTmpl = $("#discountTmpl").html();
      _.each(this.discounts, (function(_this) {
        return function(discount) {
          return _this.renderDiscount(discount);
        };
      })(this));
      return $("#new_discount").submit((function(_this) {
        return function(e) {
          $("#new_discount .errors").hide();
          if (!_this.edittingDiscount) {
            $.post("/books/" + _this.book.id + "/discounts", $("#new_discount").serialize(), function(json) {
              if (json.errors) {
                return $("#new_discount .errors").show().html(json.errors.join("<br/>"));
              } else {
                $("#manageDiscountAdd").hide();
                $("#new_discount")[0].reset();
                return _this.renderDiscount(json, true);
              }
            });
          } else {
            $.ajax({
              url: "/books/" + _this.book.id + "/discounts/" + _this.edittingDiscount.id,
              data: $("#new_discount").serialize(),
              type: 'PUT',
              success: function(json) {
                if (json.errors) {
                  return $("#new_discount .errors").show().html(json.errors.join("<br/>"));
                } else {
                  _this.cancelDiscount();
                  return _this.renderDiscount(json, true);
                }
              }
            });
          }
          return false;
        };
      })(this));
    },
    cancelDiscount: function() {
      this.edittingDiscount = false;
      $("#manageDiscountAdd").hide();
      return $("#new_discount")[0].reset();
    },
    renderDiscount: function(discount, prepend) {
      var el, existingEl, html;
      if (prepend == null) {
        prepend = false;
      }
      el = $("tr[data-id='" + discount.id + "']");
      existingEl = false;
      if (el.length > 0) {
        existingEl = true;
      } else {
        if (el.length === 0) {
          el = $("<tr>", {
            'data-id': discount.id
          });
        }
      }
      html = el.html($.tmpl(this.discountTmpl, discount));
      html.find(".deleteDiscount").click((function(_this) {
        return function() {
          if (confirm("Delete discount " + discount.code)) {
            $.ajax({
              type: "delete",
              url: "/books/" + _this.book.id + "/discounts/" + discount.id,
              success: function() {
                return html.remove();
              }
            });
          }
          return false;
        };
      })(this));
      html.find(".editDiscount").click((function(_this) {
        return function() {
          var date, day, e, field, form, id, month, year, _i, _j, _len, _len1, _ref, _ref1, _ref2;
          _this.edittingDiscount = discount;
          try {
            $("#manageDiscountAdd, .j_discountFormEdit").show();
            $(".j_discountFormCreate").hide();
            form = $("#manageDiscountAdd form");
            _ref = ["code", "amount_in_dollars", "percent", "limit"];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              field = _ref[_i];
              form.find("[name='discount[" + field + "]']").val(discount[field]);
            }
            form.find("[name='discount[expires]']").prop('checked', discount.expires);
            date = new Date(discount.expiration);
            _ref1 = [date.getMonth() + 1, date.getDate() + 1, date.getFullYear()], month = _ref1[0], day = _ref1[1], year = _ref1[2];
            form.find("#discount_expiration_2i option[value='" + month + "']").attr('selected', true);
            form.find("#discount_expiration_3i option[value='" + day + "']").attr('selected', true);
            form.find("#discount_expiration_3i option[value='" + year + "']").attr('selected', true);
            $('#discount_all_options').attr('checked', discount.all_options);
            if (!discount.all_options) {
              $(".j_discountOptionCheckboxes .checkLabel").removeClass('disabled');
              _ref2 = discount.book_option_ids;
              for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
                id = _ref2[_j];
                $(".j_discountOptionCheckboxes input[value=" + id + "]").attr('checked', true);
              }
            }
            return false;
          } catch (_error) {
            e = _error;
            log(e);
            return false;
          }
        };
      })(this));
      if (!existingEl) {
        if (prepend) {
          return html.prependTo("#discounts");
        } else {
          return html.appendTo("#discounts");
        }
      }
    }
  };

}).call(this);
(function() {
  window.Book = {
    chapter: null,
    currentScrollTop: 0,
    init: function(opts) {
      var bucket, channel, dropdownEls, emailPitchOpen, initWriteLog, logWr, navVisible, normalizeChapterNumber, offsetHeight, pusher, writeLog;
      this.opts = opts;
      if (this.preview = this.opts.preview) {
        $.ajaxSetup({
          cache: false
        });
        logWr = $("#buildStatus");
        writeLog = function(msg) {
          $("#buildStatus").append(msg);
          return logWr.animate({
            scrollTop: logWr[0].scrollHeight - logWr.height()
          }, {
            duration: 100
          });
        };
        initWriteLog = function() {
          return writeLog("Listening...\n");
        };
        initWriteLog();
        pusher = new Pusher("a0ce4dc77c0a9f4d5f96");
        channel = pusher.subscribe(this.opts.channel);
        channel.bind("status", function(data) {
          return writeLog(data.message);
        });
        channel.bind("finished", (function(_this) {
          return function(data) {
            writeLog(data.message);
            _this.reload();
            return initWriteLog();
          };
        })(this));
      }
      bucket = this.preview ? Config.previewBucket : Config.bucket;
      this.host = "" + bucket + ".s3.amazonaws.com";
      this.base_url = "https://" + this.host + "/" + this.opts.s3_path_prefix;
      $((function(_this) {
        return function() {
          return _this.getChapter();
        };
      })(this));
      $(window).on("popstate", (function(_this) {
        return function(e) {
          return _this.popState(e);
        };
      })(this));
      $(window).scroll((function(_this) {
        return function() {
          return _this.currentScrollTop = $(window).scrollTop();
        };
      })(this));
      this.slug = this.opts.slug;
      if (this.preview) {
        this.chapters = _.compact(_.map(this.opts.chapters, (function(_this) {
          return function(file, i) {
            if (file === _this.slug) {
              return null;
            }
            return {
              title: file.replace(/_/g, ' '),
              number: i,
              s3_url: "" + _this.base_url + "/html/" + file + "_fragment.html",
              slug: file
            };
          };
        })(this)));
      } else {
        this.chapters = this.opts.chapters;
      }
      this.fullPageChapter = {
        slug: "_single-page",
        title: "Single Page",
        s3_url: "" + this.base_url + "/html/" + this.slug + ".html",
        single_page: true
      };
      this.chapters.push(this.fullPageChapter);
      this.path = this.opts.path;
      dropdownEls = [];
      _.each(this.chapters, (function(_this) {
        return function(chapter) {
          var li;
          if (chapter.single_page != null) {
            return;
          }
          li = $("<li>", {
            html: $("<a>", {
              html: chapter.title
            }),
            click: function() {
              return _this.gotoChapter(chapter);
            }
          });
          return $("#j_chapterDropDown ul").append(li);
        };
      })(this));
      normalizeChapterNumber = (function(_this) {
        return function(n) {
          if (n < 0) {
            return _this.chapters.length - 1;
          } else if (n >= _this.chapters.length) {
            return 0;
          } else {
            return n;
          }
        };
      })(this);
      $(".bookMenuArows .leftArrow").click((function(_this) {
        return function() {
          return _this.gotoChapter(_.findWhere(_this.chapters, {
            number: normalizeChapterNumber(_this.chapter.number - 1)
          }));
        };
      })(this));
      $(".bookMenuArows .upArrow").click((function(_this) {
        return function() {
          return _this.scrollToHash(true);
        };
      })(this));
      $(".bookMenuArows .rightArrow").click((function(_this) {
        return function() {
          return _this.gotoChapter(_.findWhere(_this.chapters, {
            number: normalizeChapterNumber(_this.chapter.number + 1)
          }));
        };
      })(this));
      $("#j_singlePage").click((function(_this) {
        return function() {
          return _this.gotoChapter(_this.fullPageChapter);
        };
      })(this));
      $("#sizeRegular").click((function(_this) {
        return function() {
          $('#book').removeClass();
          $("#sizeRegular").addClass('current');
          $('#sizeBig').removeClass('current');
          return $('#sizeBigger').removeClass('current');
        };
      })(this));
      $("#sizeBig").click((function(_this) {
        return function() {
          $('#book').removeClass();
          $('#book').addClass('big');
          $('#sizeBig').addClass('current');
          $('#sizeRegular').removeClass('current');
          return $('#sizeBigger').removeClass('current');
        };
      })(this));
      $("#sizeBigger").click((function(_this) {
        return function() {
          $('#book').removeClass();
          $('#book').addClass('bigger');
          $('#sizeBigger').addClass('current');
          $('#sizeRegular').removeClass('current');
          return $('#sizeBig').removeClass('current');
        };
      })(this));
      navVisible = false;
      offsetHeight = $("#bookMenu").offset().top;
      emailPitchOpen = false;
      return $(window).scroll((function(_this) {
        return function() {
          if ($(window).scrollTop() > $("#bookMenu").offset().top && !navVisible) {
            $("#bookMenu").addClass("bookMenuFixed");
            navVisible = true;
          } else if ($(window).scrollTop() < offsetHeight && navVisible) {
            $("#bookMenu").removeClass("bookMenuFixed");
            navVisible = false;
          }
          if ($(window).scrollTop() > $(".container").outerHeight() * 0.6 && _this.slug === "ruby_on_rails_tutorial" && _this.chapter.slug !== 'frontmatter') {
            if (localStorage.getItem('emailClose') === "yes") {

            } else if (!emailPitchOpen) {
              emailPitchOpen = true;
              $(".emailPitch").addClass("open");
              $("#bookMenu").addClass("open");
              $("#dropBG").addClass("open");
              return $("#dropBG").show();
            }
          }
        };
      })(this));
    },
    loadingOn: function() {
      return $('#bookHtml').css({
        opacity: 0.5
      });
    },
    loadingOff: function() {
      return $('#bookHtml').css({
        opacity: 1
      });
    },
    gotoChapter: function(chapter) {
      this.pushState("" + this.path + "/" + chapter.slug);
      this.getChapter(chapter.slug);
      return false;
    },
    reload: function() {
      var slug;
      slug = this.chapter.slug;
      this.chapter = null;
      return this.getChapter(slug, this.currentScrollTop);
    },
    getChapter: function(slug, offset) {
      var chapter, clean_title, _ref;
      if (slug == null) {
        slug = (_ref = window.location.pathname.match(RegExp("" + this.path + "/(.*?)$"))) != null ? _ref[1] : void 0;
      }
      chapter = _.find(this.chapters, function(chapter) {
        return slug === chapter.slug;
      }) || this.chapters[0];
      if (chapter === this.chapter) {
        return;
      }
      this.chapter = chapter;
      $("#j_chapterDropDown #chapterTitle, .bookChapterTop").html(chapter.title);
      clean_title = chapter.title.replace(/<(?:.|\n)*?>/gm, '');
      $("title").html("" + clean_title + " | " + this.opts.title + " | Softcover.io");
      $(".bookScreenItem").hide();
      $(".bookScreenItem[data-chapter-number=" + this.chapter.number + "]").show();
      this.loadingOn();
      return $.get(this.chapter.s3_url, (function(_this) {
        return function(result) {
          var bookEl, html, parser, updateScroll, xmlDoc;
          _this.loadingOff();
          result = "<?xml version='1.0' encoding='UTF-8'?> <!DOCTYPE html><html><div id='book'>" + result + "</div></html>";
          if (window.DOMParser) {
            parser = new DOMParser;
            xmlDoc = parser.parseFromString(result, "text/xml");
          } else if (window.ActiveXObject) {
            xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
            xmlDoc.async = false;
            xmlDoc.loadXML(result);
          } else {
            alert("No suitible xml parser found!");
            return;
          }
          $.each(xmlDoc.getElementsByTagName("img"), function(index, img) {
            var src;
            src = img.getAttribute('src');
            if (!src.match(/^\//)) {
              src = "/" + src;
            }
            return img.setAttribute('src', _this.base_url + src);
          });
          $.each(xmlDoc.getElementsByTagName("script"), function(i, script) {
            return $(script).remove();
          });
          $.each(xmlDoc.getElementsByTagName("a"), function(index, a) {
            var href, url, _ref1;
            if (href = a.getAttribute('href')) {
              if (URI(href).host() === "" && ((_ref1 = a.getAttribute('class')) != null ? _ref1.match(/hyperref/) : void 0)) {
                if (href.match(/_fragment/)) {
                  url = "" + _this.path + "/" + (href.replace(/\_fragment.html/, ''));
                  return a.setAttribute('href', url);
                }
              }
            }
          });
          html = (new XMLSerializer()).serializeToString(xmlDoc);
          bookEl = $('<div>').html(html);
          $('#bookHtml').html(bookEl.find("[id=book]").last());
          $('#book [data-tralics-id], .footnotes [id], .chapter-star[id], .footnote[id]').each(function() {
            return $(this).attr('id', "_" + this.id);
          });
          $('#bookHtml').find('a').each(function(i, a) {
            return $(a).click(function(e) {
              var location, uri;
              if (e.isDefaultPrevented() || e.metaKey || e.ctrlKey || !a.href) {
                return;
              }
              uri = URI(a.href);
              location = URI(window.location.href);
              if (uri.host() === location.host()) {
                _this.pushState(uri.pathname() + uri.hash());
                if (uri.pathname() === location.pathname()) {
                  _this.scrollToHash();
                } else {
                  _this.getChapter(uri.filename());
                }
                return false;
              }
              return true;
            });
          });
          updateScroll = function() {
            if (offset) {
              $(window).scrollTop(offset + 1);
              return setTimeout(function() {
                return $(window).scrollTop(offset + 1);
              }, 10);
            } else {
              return _this.scrollToHash();
            }
          };
          updateScroll();
          return _this.initMathJax(updateScroll);
        };
      })(this)).fail((function(_this) {
        return function() {
          _this.loadingOff();
          return $("#bookHtml").html($("#bookContentNotAvailable").clone().show());
        };
      })(this));
    },
    scrollOffsets: [],
    storeScrollOffset: function() {
      return this.scrollOffsets.push(this.currentScrollTop);
    },
    scrollToHash: function(forceTop) {
      var el, hash, scrollTo;
      hash = window.location.hash;
      el = $("#_" + (hash.substr(1)));
      if (el.length === 0 || forceTop) {
        el = $("#book");
      }
      scrollTo = el.offset().top - $('#bookMenu').height() - 10;
      $(window).scrollTop(scrollTo);
      setTimeout(function() {
        return $(window).scrollTop(scrollTo);
      }, 100);
      return false;
    },
    pushState: function(uri) {
      this.storeScrollOffset();
      return history.pushState(null, {}, uri);
    },
    popState: function(e) {
      var offset;
      e.preventDefault();
      offset = this.scrollOffsets.pop();
      this.storeScrollOffset();
      return this.getChapter(null, offset);
    },
    initMathJax: function(cb) {
      var chapter_number, script;
      $('#mathJaxJS').remove();
      delete MathJax;
      chapter_number = $('.chapter').attr('data-number');
      script = document.createElement('script');
      $('head').append(script);
      script.id = 'mathJaxJS';
      script.type = 'text/javascript';
      script.onload = function() {
        MathJax.Hub.Config({
          "HTML-CSS": {
            availableFonts: ["TeX"]
          },
          TeX: {
            extensions: ["AMSmath.js", "AMSsymbols.js"],
            equationNumbers: {
              autoNumber: "AMS",
              formatNumber: function(n) {
                return chapter_number + '.' + n;
              }
            },
            Macros: {
              PolyTeX: "Poly{\\\\TeX}",
              PolyTeXnic: "Poly{\\\\TeX}nic"
            }
          },
          showProcessingMessages: false,
          messageStyle: "none",
          imageFont: null
        });
        if (cb) {
          return MathJax.Hub.Register.StartupHook("End", cb);
        }
      };
      return script.src = 'https://c328740.ssl.cf1.rackcdn.com/' + 'mathjax/latest/MathJax.js?config=TeX-AMS_HTML';
    }
  };

}).call(this);
(function() {
  window.CustomDomain = {
    setup: function(opts) {
      this.opts = opts;
      return $((function(_this) {
        return function() {
          if (_this.opts.header) {
            $(".j_userHeader").html(_this.opts.header);
            $(".j_downloadLinks").html(_this.opts.downloadLinks);
            $(".j_showPageHeader").html(_this.opts.showPageHeader);
            $(".j_followBookForm").html(_this.opts.followBookForm);
            return setupMenus();
          }
        };
      })(this));
    }
  };

}).call(this);
(function() {


}).call(this);
(function() {


}).call(this);
(function() {
  window.Purchase = {
    quantity: 1,
    discountPercent: 0,
    getCurrentBookOption: function() {
      this.optionId = $('.bundleItem.active').data('bookoption');
      return this.optionPrice = parseFloat($('.bundleItem.active').find('.j_optionPrice').data('price'));
    },
    calculatePrice: function() {
      var sub;
      this.subTotal = this.optionPrice * this.quantity;
      this.discountAmount = this.discountable() ? (sub = this.discount.amount ? this.discount.amount / 100 : 0, this.discount.percent ? sub += this.discount.percent / 100 * this.subTotal : void 0, sub > this.subTotal ? this.subTotal : sub) : 0;
      $('.j_discountApplicable').toggle(this.discountable());
      $('.j_discountUnapplicable').toggle(!this.discountable());
      this.total = this.subTotal - this.discountAmount;
      $(".j_subTotal").html("$" + (this.subTotal.toFixed(2)));
      $(".j_promoTotal").html("-$" + this.discountAmount);
      return $(".j_checkoutTotal").html("$" + (this.total.toFixed(2)));
    },
    discountable: function() {
      if (!this.discount) {
        return false;
      }
      return this.discount.book_option_ids.indexOf(this.optionId) > -1 || this.discount.all_options;
    },
    getQuantity: function() {
      var input;
      input = $('.bundleItem.active').find(".j_quantity");
      this.quantity = parseInt(input.val()) || 1;
      if (this.quantity < 1) {
        this.quantity = 1;
        input.val(1);
      }
      return this.quantity;
    },
    updateQuantityFields: function() {
      $('.j_bundleItem').not('.active').find(".j_quantity").val(this.quantity);
      return $('.j_purchaseQuantity').val(this.quantity);
    },
    init: function(opts) {
      var inputs, quantityChange;
      this.opts = opts != null ? opts : {};
      this.discount = this.opts.discount;
      $(".required").keyup(function() {
        if (!!$(this).val()) {
          return $(this).removeClass("error");
        }
      });
      if (this.useCardOnFile = this.opts.useCardOnFile) {
        inputs = $(".card-number, .card-expiry-month, .card-cvc, .card-expiry-year, .card-name");
        inputs.change((function(_this) {
          return function(e) {
            return _this.useCardOnFile = !_.any(inputs, function(el) {
              return $(el).val() !== $(el).attr("original-value");
            });
          };
        })(this)).each((function(_this) {
          return function(i, el) {
            return $(el).attr("original-value", el.value);
          };
        })(this));
      }
      this.ccForm$ = $('.j_checkoutForm');
      this.getCurrentBookOption();
      $("#j_bookOption").change((function(_this) {
        return function() {
          _this.getCurrentBookOption();
          return _this.calculatePrice();
        };
      })(this));
      this.getQuantity();
      quantityChange = (function(_this) {
        return function() {
          _this.getCurrentBookOption();
          _this.getQuantity();
          _this.updateQuantityFields();
          return _this.calculatePrice();
        };
      })(this);
      $(".j_quantity").keyup(quantityChange);
      $(".j_quantity").change(quantityChange);
      this.calculatePrice();
      this.updateQuantityFields();
      $(".j_bundleItem.active").find(".j_quantity").val(this.quantity);
      $(".j_promoCode").keypress((function(_this) {
        return function(e) {
          log('promo');
          if (e.keyCode === 13) {
            _this.ajaxPromoCode();
            e.preventDefault();
            return e.stopPropagation();
          }
        };
      })(this));
      $("#bundleOptions .j_selectBundle").click((function(_this) {
        return function(e) {
          $('.j_bundleItem').removeClass('active');
          $(e.currentTarget).closest('.j_bundleItem').addClass('active');
          $(".j_bookOption").val($(e.currentTarget).closest('.j_bundleItem').data('bookoption'));
          $('#shippingInput').toggle(!!$(e.target).data('require-shipping-address'));
          _this.getCurrentBookOption();
          _this.calculatePrice();
          e.preventDefault();
          return e.stopPropagation();
        };
      })(this));
      $('.j_updateCard').click((function(_this) {
        return function(e) {
          $('#currentCardInfo').hide();
          $('.creditCardInput').show();
          $('.card-cvc').val("");
          e.preventDefault();
          return e.stopPropagation();
        };
      })(this));
      $("#isGift").click(function() {
        return $("#giftEmails").toggle($(this).is(":checked"));
      });
      $("#purchaseFor").keypress((function(_this) {
        return function(e) {
          if (e.keyCode === 13) {
            _this.submitForm();
            e.stopPropagation();
            return e.preventDefault();
          }
        };
      })(this));
      return this.bindForm();
    },
    bindForm: function() {
      var submitOverride;
      submitOverride = (function(_this) {
        return function() {
          _this.submitForm();
          return false;
        };
      })(this);
      $('.j_checkoutForm').on('submit', submitOverride);
      $('.j_submitButton').on('click', function() {
        submitOverride();
        return false;
      });
      return $('.j_promoButton').click((function(_this) {
        return function() {
          return _this.ajaxPromoCode();
        };
      })(this));
    },
    purchaseErrors: function(text) {
      return $("#purchaseErrors").show().html("Error: " + text);
    },
    submitForm: function() {
      var stripeParams;
      $("form .required:visible").each((function(_this) {
        return function(i, el) {
          el = $(el);
          return el.toggleClass("error", !el.val());
        };
      })(this));
      if ($("form .required.error").length > 0) {
        return this.purchaseErrors("missing fields are highlighted in red.");
      }
      if ($("#purchaseEmail").val() !== $("#purchaseEmailConfirmation").val()) {
        return this.purchaseErrors("emails do not match");
      }
      if ($("#isGift").is(":checked")) {
        if ($("#giftEmail").val() !== $("#giftEmailConfirmation").val()) {
          $("#giftEmail, #giftEmailConfirmation").addClass("error");
          return this.purchaseErrors("gift emails do not match");
        }
      }
      this.disableSubmit();
      if (this.useCardOnFile) {
        return this.submitPurchase();
      } else {
        stripeParams = {
          number: $('.card-number').val(),
          cvc: $('.card-cvc').val(),
          exp_month: $('.card-expiry-month').val(),
          exp_year: $('.card-expiry-year').val(),
          name: $('.card-name').val()
        };
        return Stripe.createToken(stripeParams, (function(_this) {
          return function(status, response) {
            return _this.stripeResponseHandler(status, response);
          };
        })(this));
      }
    },
    submitPurchase: function() {
      $("#purchaseErrors").hide().html("");
      $(".j_checkoutForm input, .j_checkoutForm select").removeClass("error");
      return $.post("/purchases", this.ccForm$.serialize(), (function(_this) {
        return function(data) {
          var errors;
          if (data.success) {
            return window.location = data.redirect;
          } else {
            _this.enableSubmit();
            _this.purchaseErrors(data.errors);
            errors = data.errors;
            if (errors.card) {
              $(".card-number").addClass("error");
              _this.purchaseErrors(errors.card.join('<br/>'));
            }
            if (data.errors.cvc) {
              $(".card-cvc").addClass("error");
              _this.purchaseErrors("CVV is " + errors.cvc[0]);
            }
            return window.location.hash = '#purchaseErrors';
          }
        };
      })(this));
    },
    enableSubmit: function() {
      return $('.j_submitButton').html("Purchase").attr('disabled', false);
    },
    disableSubmit: function() {
      return $('.j_submitButton').html("Processing...").attr('disabled', true);
    },
    stripeResponseHandler: function(status, response) {
      if (response.error) {
        this.enableSubmit();
        return this.purchaseErrors(response.error.message);
      } else {
        this.ccForm$.append("<input type=hidden name='purchase[stripe_token]' value='" + response.id + "'/>");
        return this.submitPurchase();
      }
    },
    ajaxPromoCode: function() {
      var ajaxPayload, bookId, ccForm$, code;
      ccForm$ = $('.j_checkoutForm');
      code = ccForm$.find('.j_promoCode').val();
      bookId = ccForm$.find('.j_bookId').val();
      ajaxPayload = {
        promo_code: code
      };
      $.ajax({
        type: 'GET',
        url: "/books/" + bookId + "/discounts/validate",
        data: ajaxPayload,
        success: (function(_this) {
          return function(data, textStatus, jqXHR) {
            $('.j_promoStatus').removeClass('invalidPromo');
            if (data.valid) {
              _this.discountPercent = data.percent;
              _this.calculatePrice();
              return $('.j_promoStatus').html("Promotional code accepted!");
            }
          };
        })(this),
        error: function(jqXHR, textStatus, errorThrown) {
          $('.j_promoStatus').addClass('invalidPromo');
          return $('.j_promoStatus').html("Sorry, the code '" + code + "' is not valid");
        }
      });
      return false;
    },
    dev: {
      setup: function() {
        $('.card-number').change();
        $('.card-name').val("Nick Merwin");
        $('.card-cvc').val("123");
        $('.card-expiry-month').val("12");
        return $('.card-expiry-year').val("2015");
      },
      valid: function() {
        this.setup();
        return $('.card-number').val("4242424242424242");
      },
      error: function() {
        this.setup();
        return $('.card-number').val("4000000000000002");
      },
      cvc: function() {
        this.setup();
        return $('.card-number').val("4000000000000101");
      },
      declined: function() {
        this.setup();
        return $('.card-number').val("4000000000000002");
      }
    }
  };

}).call(this);
(function() {


}).call(this);
(function() {
  window.UserEdit = {
    init: function(user) {
      this.user = user;
      return $("#updateCardForm").submit((function(_this) {
        return function() {
          $("#card-errors, #card-status").hide();
          _this.stripeParams = {
            number: $('.card-number').val(),
            cvc: $('.card-cvc').val(),
            exp_month: $('.card-expiry-month').val(),
            exp_year: $('.card-expiry-year').val(),
            name: $('.card-name').val(),
            address_line1: $('.card-address-line1').val(),
            address_line2: $('.card-address-line2').val(),
            address_city: $('.card-address-city').val(),
            address_state: $('.card-address-state').val(),
            address_zip: $('.card-address-zip').val(),
            address_country: $('.card-address-country').val()
          };
          Stripe.createToken(_this.stripeParams, function(status, response) {
            return _this.stripeResponseHandler(status, response);
          });
          return false;
        };
      })(this));
    },
    stripeResponseHandler: function(status, response) {
      if (response.error) {
        return $("#card-errors").show().html(response.error.message);
      } else {
        $("#card-status").show().html("Payment info updated.");
        return $.ajax({
          url: "/users/" + this.user.id,
          type: "PUT",
          dataType: "json",
          data: {
            user: {
              stripe_token: response.id
            }
          },
          success: (function(_this) {
            return function(json) {
              return log(json);
            };
          })(this)
        });
      }
    }
  };

}).call(this);
(function() {
  var chartData, chartHeader, chartList, chartTable, colors,
    __slice = [].slice;

  window.log = (function(_this) {
    return function() {
      var args, e;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      try {
        return console.log.apply(console, args);
      } catch (_error) {
        e = _error;
      }
    };
  })(this);

  window.genericAjaxErrorCallback = function(e, xhr, settings, exception) {
    return log('AJAX error with URL: \n\t\t' + settings.url + ' \n' + 'error:\n\t\t' + exception);
  };

  $(document).ajaxError(genericAjaxErrorCallback);

  window.setupMenus = function() {
    $('.bookCover').click(function() {
      return $(this).parents('.yourBookItem').addClass('active');
    });
    $('.bookControls').click(function() {
      return $(this).parents('.yourBookItem').removeClass('animated');
    });
    $('.dropDown').click(function() {
      $('.dropMenu', this).addClass('open');
      return $('#dropBG').show();
    });
    $('#dropBG').click(function() {
      $('.dropMenu').removeClass('open');
      $('#dropBG').hide();
      return closeEmailPops();
    });
    $('.dropMenu a').click(function() {
      $('.dropMenu').removeClass('open');
      return $('#dropBG').hide();
    });
    $('#mobileMenu').click(function() {
      $('.j_userHeader').toggleClass('openLeft').toggleClass('closeLeft');
      return $('.container').toggleClass('openLeft').toggleClass('closeLeft');
    });
    return $(document).keyup(function(e) {
      if (e.which === 27 && $('.dropMenu').hasClass('open')) {
        $('.dropMenu').removeClass('open');
        return $('#dropBG').hide();
      }
    });
  };

  $(function() {
    return setupMenus();
  });

  window.marketingCTA = function() {
    var buyShow, ctaShow, faqShow, freeShow, nextShow, testaShow;
    if ($('#bookPricing').length) {
      ctaShow = $('#bookPricing').offset().top;
      buyShow = $('#bookPricing').offset().top + ($('#bookPricing').outerHeight() / 2);
    } else {
      ctaShow = $('#bookTestimonials').offset().top;
    }
    testaShow = $('#bookTestimonials').offset().top;
    if ($('#bookFAQ').length) {
      faqShow = $('#bookFAQ').offset().top;
    }
    if ($('#bookFreeForm').length) {
      freeShow = $('#bookFreeForm').offset().top;
    }
    nextShow = "#bookTestimonials";
    $(window).scroll((function(_this) {
      return function() {
        if ($(window).scrollTop() < ctaShow) {
          $('#bookCTA').removeClass('show');
        } else if ($(window).scrollTop() >= ctaShow) {
          $('#bookCTA').addClass('show');
          nextShow = "#bookTestimonials";
          $('#ctaNext button').text("Next Section: About the Author");
        }
        if ($(window).scrollTop() >= buyShow) {
          $('#ctaBuy').addClass('show');
        } else if ($(window).scrollTop() < buyShow) {
          $('#ctaBuy').removeClass('show');
        }
        if ($(window).scrollTop() >= testaShow - 1) {
          if ($('#bookFAQ').length) {
            nextShow = "#bookFAQ";
            $('#ctaNext button').text("NEXT SECTION: FAQ");
          } else if ($('#bookFreeForm').length) {
            nextShow = "#bookFreeForm";
            $('#ctaNext button').text("NEXT SECTION: MORE INFO");
          }
        }
        if ($(window).scrollTop() >= faqShow - 1) {
          if ($('#bookFreeForm').length) {
            nextShow = "#bookFreeForm";
            $('#ctaNext button').text("NEXT SECTION: MORE INFO");
          } else {
            return;
          }
        }
        if ($(window).scrollTop() >= freeShow - 1) {
          nextShow = "#bookHeader";
          return $('#ctaNext button').text("BACK TO TOP");
        }
      };
    })(this));
    $('#ctaNext').click(function() {
      return $('html,body').animate({
        scrollTop: $(nextShow).offset().top
      }, 1000);
    });
    return $('#ctaBuy').click(function() {
      return $('html,body').animate({
        scrollTop: $("#bookPricing").offset().top
      }, 1000);
    });
  };

  window.closeEmailPops = function() {
    localStorage.setItem('emailClose', 'yes');
    $('.emailPitch').removeClass('open');
    $("#bookMenu").removeClass('open');
    $('#dropBG').removeClass('open');
    return $('#dropBG').hide();
  };

  chartList = [];

  chartHeader = [];

  chartTable = [];

  chartData = [];

  colors = ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099"];

  window.gchartAllOne = function() {
    var data, options;
    $("#chartWr").append($("<div/>").attr("id", "chart"));
    chartTable = [];
    chartHeader = [];
    chartData = [];
    $(".chartTable thead").each(function() {
      $(this).find("th").each(function() {
        return chartHeader.push($(this).html());
      });
      chartHeader.shift();
      return chartHeader.unshift("x");
    });
    $(".chartTable tbody").find("tr").each(function() {
      $(this).find(".datum").each(function(i) {
        if (i === 0) {
          return chartData.push($(this).html());
        } else {
          return chartData.push(parseFloat($(this).html().match(/[0-9,.]+/)[0].replace(',', '')));
        }
      });
      chartTable.push(chartData);
      return chartData = [];
    });
    chartTable.reverse();
    chartTable.unshift(chartHeader);
    log(chartTable);
    options = {
      chartArea: {
        width: 880
      },
      backgroundColor: 'transparent',
      fontName: 'Open Sans Condensed',
      width: 980,
      height: 400,
      lineWidth: 3,
      pointSize: 5,
      legend: {
        position: 'bottom',
        textStyle: {
          color: '#666'
        }
      },
      hAxis: {
        textStyle: {
          color: '#aaa',
          fontSize: '12'
        }
      },
      vAxis: {
        baselineColor: '#B9C6D3',
        gridlines: {
          color: '#dfe4ef'
        },
        textStyle: {
          color: '#aaa',
          fontSize: '12'
        }
      },
      tooltip: {
        textStyle: {
          fontName: 'Open Sans',
          color: '#666',
          fontSize: '12',
          showColorCode: 'true'
        }
      }
    };
    data = google.visualization.arrayToDataTable(chartTable);
    return new google.visualization.LineChart(document.getElementById('chart')).draw(data, options);
  };

  window.gchartMany = function(chartL) {
    var colorList, data, el, en, exists, f, options, vl;
    exists = chartList.lastIndexOf(chartL);
    if (exists > -1) {
      chartList.splice(exists, 1);
    } else if (chartL !== void 0) {
      chartList.push(chartL);
    }
    chartData = [];
    colorList = [];
    chartData.push(["x"]);
    en = 0;
    while (en < chartTable.length) {
      chartData.push([]);
      en++;
    }
    $('#chartNav a').removeClass('on');
    el = 0;
    while (el < chartList.length) {
      vl = chartList[el].valueOf();
      chartData[0].push(chartHeader[vl]);
      $('#chartNav' + chartList[el]).addClass('on');
      colorList.push(colors[vl]);
      el++;
    }
    en = 0;
    while (en < chartTable.length) {
      chartData[en + 1].push(chartTable[en][0]);
      el = 0;
      while (el < chartList.length) {
        vl = chartList[el].valueOf() + 1;
        chartData[en + 1].push(chartTable[en][vl]);
        el++;
      }
      en++;
    }
    f = chartData.shift();
    chartData.reverse();
    chartData.unshift(f);
    options = {
      chartArea: {
        width: 880
      },
      backgroundColor: 'transparent',
      colors: colorList,
      fontName: 'Open Sans Condensed',
      width: 980,
      height: 400,
      lineWidth: 3,
      pointSize: 5,
      legend: {
        position: 'none'
      },
      hAxis: {
        textStyle: {
          color: '#aaa',
          fontSize: '12'
        }
      },
      vAxis: {
        baselineColor: '#B9C6D3',
        gridlines: {
          color: '#dfe4ef'
        },
        textStyle: {
          color: '#aaa',
          fontSize: '12'
        }
      },
      tooltip: {
        textStyle: {
          fontName: 'Open Sans',
          color: '#666',
          fontSize: '12',
          showColorCode: 'true'
        }
      }
    };
    data = google.visualization.arrayToDataTable(chartData);
    return new google.visualization.LineChart(document.getElementById('chart')).draw(data, options);
  };

  window.gchartInit = function() {
    var i;
    $("#chartWr").append($("<div/>").attr("id", "chart"));
    $("#chartWr").append($("<div/>").attr("id", "chartNav"));
    $(".chartTable thead").each(function() {
      $(this).find("th").each(function() {
        return chartHeader.push($(this).html());
      });
      return chartHeader.shift();
    });
    i = 0;
    while (i < chartHeader.length) {
      $("#chartNav").append($('<a href="javascript://" onClick="gchartMany(' + i + ')" id="chartNav' + i + '"><span style="background-color:' + colors[i] + ';"></span>' + chartHeader[i] + '</a>"'));
      i++;
    }
    $(".chartTable tbody").find("tr").each(function() {
      $(this).find("td .datum").each(function(i) {
        if (i === 0) {
          return chartData.push($(this).html());
        } else {
          return chartData.push(parseFloat($(this).html().match(/[0-9,.]+/)[0].replace(',', '')));
        }
      });
      chartTable.push(chartData);
      return chartData = [];
    });
    return gchartMany(2);
  };

}).call(this);
// Generated by CoffeeScript 1.4.0
(function() {
  var $, cardFromNumber, cardFromType, cards, defaultFormat, formatBackCardNumber, formatBackExpiry, formatCardNumber, formatExpiry, formatForwardExpiry, formatForwardSlash, hasTextSelected, luhnCheck, reFormatCardNumber, restrictCVC, restrictCardNumber, restrictExpiry, restrictNumeric, setCardType,
    __slice = [].slice,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
    _this = this;

  $ = jQuery;

  $.payment = {};

  $.payment.fn = {};

  $.fn.payment = function() {
    var args, method;
    method = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    return $.payment.fn[method].apply(this, args);
  };

  defaultFormat = /(\d{1,4})/g;

  cards = [
    {
      type: 'maestro',
      pattern: /^(5018|5020|5038|6304|6759|676[1-3])/,
      format: defaultFormat,
      length: [12, 13, 14, 15, 16, 17, 18, 19],
      cvcLength: [3],
      luhn: true
    }, {
      type: 'dinersclub',
      pattern: /^(36|38|30[0-5])/,
      format: defaultFormat,
      length: [14],
      cvcLength: [3],
      luhn: true
    }, {
      type: 'laser',
      pattern: /^(6706|6771|6709)/,
      format: defaultFormat,
      length: [16, 17, 18, 19],
      cvcLength: [3],
      luhn: true
    }, {
      type: 'jcb',
      pattern: /^35/,
      format: defaultFormat,
      length: [16],
      cvcLength: [3],
      luhn: true
    }, {
      type: 'unionpay',
      pattern: /^62/,
      format: defaultFormat,
      length: [16, 17, 18, 19],
      cvcLength: [3],
      luhn: false
    }, {
      type: 'discover',
      pattern: /^(6011|65|64[4-9]|622)/,
      format: defaultFormat,
      length: [16],
      cvcLength: [3],
      luhn: true
    }, {
      type: 'mastercard',
      pattern: /^5[1-5]/,
      format: defaultFormat,
      length: [16],
      cvcLength: [3],
      luhn: true
    }, {
      type: 'amex',
      pattern: /^3[47]/,
      format: /(\d{1,4})(\d{1,6})?(\d{1,5})?/,
      length: [15],
      cvcLength: [3, 4],
      luhn: true
    }, {
      type: 'visa',
      pattern: /^4/,
      format: defaultFormat,
      length: [13, 14, 15, 16],
      cvcLength: [3],
      luhn: true
    }
  ];

  cardFromNumber = function(num) {
    var card, _i, _len;
    num = (num + '').replace(/\D/g, '');
    for (_i = 0, _len = cards.length; _i < _len; _i++) {
      card = cards[_i];
      if (card.pattern.test(num)) {
        return card;
      }
    }
  };

  cardFromType = function(type) {
    var card, _i, _len;
    for (_i = 0, _len = cards.length; _i < _len; _i++) {
      card = cards[_i];
      if (card.type === type) {
        return card;
      }
    }
  };

  luhnCheck = function(num) {
    var digit, digits, odd, sum, _i, _len;
    odd = true;
    sum = 0;
    digits = (num + '').split('').reverse();
    for (_i = 0, _len = digits.length; _i < _len; _i++) {
      digit = digits[_i];
      digit = parseInt(digit, 10);
      if ((odd = !odd)) {
        digit *= 2;
      }
      if (digit > 9) {
        digit -= 9;
      }
      sum += digit;
    }
    return sum % 10 === 0;
  };

  hasTextSelected = function($target) {
    var _ref;
    if (($target.prop('selectionStart') != null) && $target.prop('selectionStart') !== $target.prop('selectionEnd')) {
      return true;
    }
    if (typeof document !== "undefined" && document !== null ? (_ref = document.selection) != null ? typeof _ref.createRange === "function" ? _ref.createRange().text : void 0 : void 0 : void 0) {
      return true;
    }
    return false;
  };

  reFormatCardNumber = function(e) {
    var _this = this;
    return setTimeout(function() {
      var $target, value;
      $target = $(e.currentTarget);
      value = $target.val();
      value = $.payment.formatCardNumber(value);
      return $target.val(value);
    });
  };

  formatCardNumber = function(e) {
    var $target, card, digit, length, re, upperLength, value;
    digit = String.fromCharCode(e.which);
    if (!/^\d+$/.test(digit)) {
      return;
    }
    $target = $(e.currentTarget);
    value = $target.val();
    card = cardFromNumber(value + digit);
    length = (value.replace(/\D/g, '') + digit).length;
    upperLength = 16;
    if (card) {
      upperLength = card.length[card.length.length - 1];
    }
    if (length >= upperLength) {
      return;
    }
    if (($target.prop('selectionStart') != null) && $target.prop('selectionStart') !== value.length) {
      return;
    }
    if (card && card.type === 'amex') {
      re = /^(\d{4}|\d{4}\s\d{6})$/;
    } else {
      re = /(?:^|\s)(\d{4})$/;
    }
    if (re.test(value)) {
      e.preventDefault();
      return $target.val(value + ' ' + digit);
    } else if (re.test(value + digit)) {
      e.preventDefault();
      return $target.val(value + digit + ' ');
    }
  };

  formatBackCardNumber = function(e) {
    var $target, value;
    $target = $(e.currentTarget);
    value = $target.val();
    if (e.meta) {
      return;
    }
    if (($target.prop('selectionStart') != null) && $target.prop('selectionStart') !== value.length) {
      return;
    }
    if (e.which === 8 && /\s\d?$/.test(value)) {
      e.preventDefault();
      return $target.val(value.replace(/\s\d?$/, ''));
    }
  };

  formatExpiry = function(e) {
    var $target, digit, val;
    digit = String.fromCharCode(e.which);
    if (!/^\d+$/.test(digit)) {
      return;
    }
    $target = $(e.currentTarget);
    val = $target.val() + digit;
    if (/^\d$/.test(val) && (val !== '0' && val !== '1')) {
      e.preventDefault();
      return $target.val("0" + val + " / ");
    } else if (/^\d\d$/.test(val)) {
      e.preventDefault();
      return $target.val("" + val + " / ");
    }
  };

  formatForwardExpiry = function(e) {
    var $target, digit, val;
    digit = String.fromCharCode(e.which);
    if (!/^\d+$/.test(digit)) {
      return;
    }
    $target = $(e.currentTarget);
    val = $target.val();
    if (/^\d\d$/.test(val)) {
      return $target.val("" + val + " / ");
    }
  };

  formatForwardSlash = function(e) {
    var $target, slash, val;
    slash = String.fromCharCode(e.which);
    if (slash !== '/') {
      return;
    }
    $target = $(e.currentTarget);
    val = $target.val();
    if (/^\d$/.test(val) && val !== '0') {
      return $target.val("0" + val + " / ");
    }
  };

  formatBackExpiry = function(e) {
    var $target, value;
    if (e.meta) {
      return;
    }
    $target = $(e.currentTarget);
    value = $target.val();
    if (e.which !== 8) {
      return;
    }
    if (($target.prop('selectionStart') != null) && $target.prop('selectionStart') !== value.length) {
      return;
    }
    if (/\s\/\s?\d?$/.test(value)) {
      e.preventDefault();
      return $target.val(value.replace(/\s\/\s?\d?$/, ''));
    }
  };

  restrictNumeric = function(e) {
    var input;
    if (e.metaKey || e.ctrlKey) {
      return true;
    }
    if (e.which === 32) {
      return false;
    }
    if (e.which === 0) {
      return true;
    }
    if (e.which < 33) {
      return true;
    }
    input = String.fromCharCode(e.which);
    return !!/[\d\s]/.test(input);
  };

  restrictCardNumber = function(e) {
    var $target, card, digit, value;
    $target = $(e.currentTarget);
    digit = String.fromCharCode(e.which);
    if (!/^\d+$/.test(digit)) {
      return;
    }
    if (hasTextSelected($target)) {
      return;
    }
    value = ($target.val() + digit).replace(/\D/g, '');
    card = cardFromNumber(value);
    if (card) {
      return value.length <= card.length[card.length.length - 1];
    } else {
      return value.length <= 16;
    }
  };

  restrictExpiry = function(e) {
    var $target, digit, value;
    $target = $(e.currentTarget);
    digit = String.fromCharCode(e.which);
    if (!/^\d+$/.test(digit)) {
      return;
    }
    if (hasTextSelected($target)) {
      return;
    }
    value = $target.val() + digit;
    value = value.replace(/\D/g, '');
    if (value.length > 6) {
      return false;
    }
  };

  restrictCVC = function(e) {
    var $target, digit, val;
    $target = $(e.currentTarget);
    digit = String.fromCharCode(e.which);
    if (!/^\d+$/.test(digit)) {
      return;
    }
    val = $target.val() + digit;
    return val.length <= 4;
  };

  setCardType = function(e) {
    var $target, allTypes, card, cardType, val;
    $target = $(e.currentTarget);
    val = $target.val();
    cardType = $.payment.cardType(val) || 'unknown';
    if (!$target.hasClass(cardType)) {
      allTypes = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = cards.length; _i < _len; _i++) {
          card = cards[_i];
          _results.push(card.type);
        }
        return _results;
      })();
      $target.removeClass('unknown');
      $target.removeClass(allTypes.join(' '));
      $target.addClass(cardType);
      $target.toggleClass('identified', cardType !== 'unknown');
      return $target.trigger('payment.cardType', cardType);
    }
  };

  $.payment.fn.formatCardCVC = function() {
    this.payment('restrictNumeric');
    this.on('keypress', restrictCVC);
    return this;
  };

  $.payment.fn.formatCardExpiry = function() {
    this.payment('restrictNumeric');
    this.on('keypress', restrictExpiry);
    this.on('keypress', formatExpiry);
    this.on('keypress', formatForwardSlash);
    this.on('keypress', formatForwardExpiry);
    this.on('keydown', formatBackExpiry);
    return this;
  };

  $.payment.fn.formatCardNumber = function() {
    this.payment('restrictNumeric');
    this.on('keypress', restrictCardNumber);
    this.on('keypress', formatCardNumber);
    this.on('keydown', formatBackCardNumber);
    this.on('keyup', setCardType);
    this.on('paste', reFormatCardNumber);
    return this;
  };

  $.payment.fn.restrictNumeric = function() {
    this.on('keypress', restrictNumeric);
    return this;
  };

  $.payment.fn.cardExpiryVal = function() {
    return $.payment.cardExpiryVal($(this).val());
  };

  $.payment.cardExpiryVal = function(value) {
    var month, prefix, year, _ref;
    value = value.replace(/\s/g, '');
    _ref = value.split('/', 2), month = _ref[0], year = _ref[1];
    if ((year != null ? year.length : void 0) === 2 && /^\d+$/.test(year)) {
      prefix = (new Date).getFullYear();
      prefix = prefix.toString().slice(0, 2);
      year = prefix + year;
    }
    month = parseInt(month, 10);
    year = parseInt(year, 10);
    return {
      month: month,
      year: year
    };
  };

  $.payment.validateCardNumber = function(num) {
    var card, _ref;
    num = (num + '').replace(/\s+|-/g, '');
    if (!/^\d+$/.test(num)) {
      return false;
    }
    card = cardFromNumber(num);
    if (!card) {
      return false;
    }
    return (_ref = num.length, __indexOf.call(card.length, _ref) >= 0) && (card.luhn === false || luhnCheck(num));
  };

  $.payment.validateCardExpiry = function(month, year) {
    var currentTime, expiry, _ref;
    if (typeof month === 'object' && 'month' in month) {
      _ref = month, month = _ref.month, year = _ref.year;
    }
    if (!(month && year)) {
      return false;
    }
    month = $.trim(month);
    year = $.trim(year);
    if (!/^\d+$/.test(month)) {
      return false;
    }
    if (!/^\d+$/.test(year)) {
      return false;
    }
    if (!(parseInt(month, 10) <= 12)) {
      return false;
    }
    expiry = new Date(year, month);
    currentTime = new Date;
    expiry.setMonth(expiry.getMonth() - 1);
    expiry.setMonth(expiry.getMonth() + 1, 1);
    return expiry > currentTime;
  };

  $.payment.validateCardCVC = function(cvc, type) {
    var _ref, _ref1;
    cvc = $.trim(cvc);
    if (!/^\d+$/.test(cvc)) {
      return false;
    }
    if (type) {
      return _ref = cvc.length, __indexOf.call((_ref1 = cardFromType(type)) != null ? _ref1.cvcLength : void 0, _ref) >= 0;
    } else {
      return cvc.length >= 3 && cvc.length <= 4;
    }
  };

  $.payment.cardType = function(num) {
    var _ref;
    if (!num) {
      return null;
    }
    return ((_ref = cardFromNumber(num)) != null ? _ref.type : void 0) || null;
  };

  $.payment.formatCardNumber = function(num) {
    var card, groups, upperLength, _ref;
    card = cardFromNumber(num);
    if (!card) {
      return num;
    }
    upperLength = card.length[card.length.length - 1];
    num = num.replace(/\D/g, '');
    num = num.slice(0, +upperLength + 1 || 9e9);
    if (card.format.global) {
      return (_ref = num.match(card.format)) != null ? _ref.join(' ') : void 0;
    } else {
      groups = card.format.exec(num);
      if (groups != null) {
        groups.shift();
      }
      return groups != null ? groups.join(' ') : void 0;
    }
  };

}).call(this);
// This is a manifest file that'll be compiled into application.js, which will include all the files
// listed below.
//
// Any JavaScript/Coffee file within this directory, lib/assets/javascripts, vendor/assets/javascripts,
// or vendor/assets/javascripts of plugins, if any, can be referenced here using a relative path.
//
// It's not advisable to add code directly here, but if you do, it'll appear at the bottom of the
// the compiled file.
//
// WARNING: THE FIRST BLANK LINE MARKS THE END OF WHAT'S TO BE PROCESSED, ANY BLANK LINE SHOULD
// GO AFTER THE REQUIRES BELOW.
//





;
