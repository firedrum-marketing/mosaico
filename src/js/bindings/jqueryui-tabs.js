"use strict";
/* global global: false */

// Overrides native jQuery tabs to make tabs working also when using a base tag
// in order to avoid conflicts you have to add a data-local="true" attribute to your tab links.

var $ = require('jquery');
require('jquery-mousewheel')($);
require('jquery-ui');
var tabs = $.ui.tabs;

if (typeof tabs == 'undefined') throw "Cannot find jquery-ui tabs widget dependency!";

$.widget("ui.tabs", tabs, {
  options: $.extend( tabs.options, {
    scrollDistance: 300,
    scrollDuration: 300,
    leftArrowSize: 20,
    rightArrowSize: 20
  } ),
  _isLocal: function( anchor ) {
    if ( anchor.getAttribute( 'data-local' ) === 'true' ) {
      return true;
    } else {
      return this._superApply( arguments );
    }
  },
  _create: function() {
    $.data( this, 'ui-tabs-scroll-position', 0 );

    this._superApply( arguments );

    this.tablist.wrap( '<div class="ui-tabs-scroll" style="margin:0px;white-space:nowrap;position:absolute;top:0px;left:0;right:0"/>' );
    this.tablist.parent().prepend( '<span class="ui-tabs-scroll-left-finisher" style="display:none">&nbsp;</span>' ).append( '<span class="ui-tabs-scroll-right-finisher" style="display:none">&nbsp;</span>' );
    this.tablist.before( '<div class="ui-tabs-scroll-left-button material-icons material-icons-chevron-left" style="position:absolute;left:0;bottom:0;cursor:pointer;text-align:center;line-height:31px"/>' ).after( '<div class="ui-tabs-scroll-right-button material-icons material-icons-chevron-right" style="position:absolute;right:0;bottom:0;cursor:pointer;text-align:center;line-height:31px"/>' );

    this.tablist.css( {
      'position': 'relative',
      'overflow': 'hidden',
      '-ms-text-overflow': 'clip',
      'text-overflow': 'clip',
      'top': '1px'
    } );

    var handle_mousewheel = function( event ) {
      // Only do mousewheel scrolling if scrolling is necessary
      if ( this.tablist[0].scrollWidth > Math.ceil( this.tablist.parent().outerWidth() ) ) {
        var delta = ( event.deltaY === 0 ? event.deltaX : event.deltaY ) * 30, left;
        if ( delta !== 0 ) {
          if ( delta < 0 ) {
            left = Math.max( this.tablist.scrollLeft() + delta, 0 );
          } else {
            left = Math.min( this.tablist.scrollLeft() + delta, this.tablist[0].scrollWidth - Math.ceil( this.tablist.outerWidth() ) );
          }
          $.data( this, 'ui-tabs-scroll-position', left );
          this.tablist.scrollLeft( left );
          event.preventDefault();
        }
      }
    };
    this.tablist.mousewheel( $.proxy( function( event ) {
      global.requestAnimationFrame( $.proxy( handle_mousewheel, this, event ) );
    }, this ) );

    var size_check = $.proxy( function() {
      var parent = this.tablist.parent();
      var panel_width = Math.ceil( parent.outerWidth() );

      if ( this.tablist[0].scrollWidth > panel_width) {
        parent.find( '.ui-tabs-scroll-right-button, .ui-tabs-scroll-left-button' ).show();
        this.tablist.css( 'left', this.options.leftArrowSize + 'px' );
        this.tablist.width( parent.width() - this.options.leftArrowSize - this.options.rightArrowSize );
        parent.find( '.ui-tabs-scroll-left-finisher, .ui-tabs-scroll-right-finisher' ).css( 'display', 'none' );

        if( this.tablist[0].scrollWidth - panel_width === this.tablist.scrollLeft() ) {
          parent.find( '.ui-tabs-scroll-right-button' ).addClass( 'ui-tabs-scroll-right-button-disabled' );
        } else {
          parent.find( '.ui-tabs-scroll-right-button' ).removeClass( 'ui-tabs-scroll-right-button-disabled' );
        }
        if ( this.tablist.scrollLeft() === 0 ) {
          parent.find( '.ui-tabs-scroll-left-button' ).addClass( 'ui-tabs-scroll-left-button-disabled' );
        } else {
          parent.find( '.ui-tabs-scroll-left-button' ).removeClass( 'ui-tabs-scroll-left-button-disabled' );
        }
      } else {
        parent.find( '.ui-tabs-scroll-right-button, .ui-tabs-scroll-left-button' ).hide();
        this.tablist.css( 'left', 0 );
        this.tablist.width( panel_width );
      }
    }, this );

    global.requestAnimationFrame( size_check );

    this.__size_check_interval = global.setInterval( function() {
      global.requestAnimationFrame( size_check );
    }, 500 );

    this.element.on( 'mousedown' + this.eventNamespace, '.ui-tabs-scroll-right-button', $.proxy( function( event ) {
      event.stopPropagation();

      var scrollRightFunc = $.proxy( function() {
        var left = this.tablist.scrollLeft();
        $.data( this, 'ui-tabs-scroll-position', Math.min( left + this.options.scrollDistance, this.tablist[0].scrollWidth - Math.ceil( this.tablist.outerWidth() ) ) );
        this.tablist.animate( {
          'scrollLeft': $.data( this, 'ui-tabs-scroll-position' ) + 'px'
        }, this.options.scrollDuration );
      }, this );

      global.requestAnimationFrame( scrollRightFunc );

      this.__press_and_hold_interval = global.setInterval( function() {
          global.requestAnimationFrame( scrollRightFunc );
      }, this.options.scrollDuration );
    }, this ) ).on( 'mouseup' + this.eventNamespace + ' mouseleave' + this.eventNamespace, '.ui-tabs-scroll-right-button', $.proxy( function( event ) {
      global.clearInterval( this.__press_and_hold_interval );
    }, this ) ).on ( 'mouseover' + this.eventNamespace, '.ui-tabs-scroll-right-button', function( event ) {
      $( this ).addClass( 'ui-state-hover' );
    } ).on( 'mouseout' + this.eventNamespace, '.ui-tabs-scroll-right-button', function( event ) {
      $( this ).removeClass( 'ui-state-hover' );
    } );

    this.element.on( 'mousedown' + this.eventNamespace, '.ui-tabs-scroll-left-button', $.proxy( function( event ) {
      event.stopPropagation();

      var scrollLeftFunc = $.proxy( function() {
        var left = this.tablist.scrollLeft();
        $.data( this, 'ui-tabs-scroll-position', Math.max( left - this.options.scrollDistance, 0 ) );
        this.tablist.animate( {
          'scrollLeft': $.data( this, 'ui-tabs-scroll-position' ) + 'px'
        }, this.options.scrollDuration );
      }, this );

      global.requestAnimationFrame( scrollLeftFunc );

      this.__press_and_hold_interval = global.setInterval( function() {
        global.requestAnimationFrame( scrollLeftFunc );
      }, this.options.scrollDuration );
    }, this ) ).on( 'mouseup' + this.eventNamespace + ' mouseleave' + this.eventNamespace, '.ui-tabs-scroll-left-button', $.proxy( function() {
      global.clearInterval( this.__press_and_hold_interval );
    }, this ) ).on( 'mouseover' + this.eventNamespace, '.ui-tabs-scroll-left-button', function( event ) {
      $( this ).addClass( 'ui-state-hover' );
    } ).on( 'mouseout' + this.eventNamespace, '.ui-tabs-scroll-left-button', function( event ) {
      $( this ).removeClass( 'ui-state-hover' );
    } );

    this.element.on( 'tabsactivate', function( event, ui ) {
      // "Slide" it into view if not fully visible.
      global.requestAnimationFrame( scroll_selected_into_view );
    } );

    var scroll_selected_into_view = $.proxy( function() {
      var left = this.tablist.scrollLeft();
      var scroll_width = this.tablist.width();
      if ( this.active && typeof this.active !== 'undefined' ) {
        var position = this.active.position();
        if ( typeof position !== 'undefined' ) {
          if ( position.left < 0 ) {
            $.data( this, 'ui-tabs-scroll-position', Math.max( left + position.left + 1, 0 ) );
            this.tablist.animate( {
              'scrollLeft': $.data( this, 'ui-tabs-scroll-position' ) + 'px'
            }, this.options.scrollDuration );
          } else {
            var outer_width = Math.ceil( this.active.outerWidth() );
            if ( ( position.left + outer_width ) > scroll_width ) {
              $.data( this, 'ui-tabs-scroll-position', Math.min( left + ( ( position.left + outer_width ) - scroll_width ), this.tablist[0].scrollWidth - Math.ceil( this.tablist.outerWidth() ) ) );
              this.tablist.animate( {
                'scrollLeft': $.data( this, 'ui-tabs-scroll-position' ) + 'px'
              }, this.options.scrollDuration );
            }
          }
        }
      }
    }, this );

    this._refresh();
  },
  _destroy: function() {
    if ( typeof this.__size_check_interval === 'undefined' || this.__size_check_interval === null ) {
      global.clearInterval( this.__size_check_interval );
    }
    if ( typeof this.__press_and_hold_interval === 'undefined' || this.__press_and_hold_interval === null ) {
      global.clearInterval( this.__press_and_hold_interval );
    }
    this._superApply( arguments );
  },
  _refresh: function() {
    this._superApply( arguments );

    this.tabs.css( {
      'display': 'inline-block',
      'zoom': 1,
      '*display': 'inline',
      '_height': '40px',
      '-webkit-user-select': 'none',
      '-khtml-user-select': 'none',
      '-moz-user-select': 'none',
      '-ms-user-select': 'none',
      '-o-user-select': 'none',
      'user-select': 'none'
    } );

    this.tablist.parent().find( '.ui-tabs-scroll-left-button' ).css( {
      'width': this.options.leftArrowSize + 'px'
    } );

    this.tablist.parent().find( '.ui-tabs-scroll-right-button' ).css( {
      'width': this.options.rightArrowSize + 'px'
    } );

    this.tablist.animate( {
      'scrollLeft': $.data( this, 'ui-tabs-scroll-position' ) + 'px'
    }, 0 );

    if ( !this.active.length && this.tabs.length > 0 ) {
      this._activate( 0 );
    }
  }
} );