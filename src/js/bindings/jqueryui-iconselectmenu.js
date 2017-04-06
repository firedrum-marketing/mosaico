"use strict";

// Creates new jQuery select menu that supports icons.

var $ = require('jquery');
require('jquery-ui');
var selectmenu = $.ui.selectmenu;
var console = require('console');

if (typeof selectmenu == 'undefined') throw "Cannot find jquery-ui selectmenu widget dependency!";

$.widget( "custom.iconselectmenu", selectmenu, {
  _renderButtonItem: function( item ) {

		var buttonItem = $( '<div class="ui-menu ui-menu-icons customicons"><div class="ui-menu-item"><div class="ui-menu-item-wrapper" style="padding-top: 0;padding-bottom: 0;">' + item.label + '<span class="ui-icon moxman-ico moxman-i-' + item.element.data("class") + '"></span></div></div></div>' );

		return buttonItem;
	},
	_renderItem: function( ul, item ) {
		var li = $( "<li>" ),
		wrapper = $( "<div>", { text: item.label } );

		if ( item.disabled ) {
			li.addClass( "ui-state-disabled" );
		}
		
		$( "<span>", {
			style: item.element.attr( "data-style" ),
			"class": "ui-icon " + item.element.attr( "data-class" )
		}).appendTo( wrapper );

		return li.append( wrapper ).appendTo( ul );
	}
} );
