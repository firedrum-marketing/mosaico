/* globals document: false */

"use strict";

// Creates an emojiarea.

var ko = require( "knockout" );
var $ = require( 'jquery' );
require( 'jquery-textcomplete' );
require( 'jquery-textselection' );
require( 'emojionearea' );

ko.bindingHandlers[ 'emojionearea' ] = {
  init: function( element, valueAccessor, allBindings ) {
    var options = valueAccessor() || {};
    var value = options.value;

    // In order to have a correct dependency tracking in "ifSubs" we have to ensure we use a single computer for each editable
    // property. Given this binding needs 2 of them, we create a computed so to "proxy" the dependencies.
    var newDO = ko.computed( {
      read: value,
      write: value,
      disposeWhenNodeIsRemoved: element
    } );
    var newVA = function() {
      return newDO;
    };

    ko.bindingHandlers.value.init( element, newVA, allBindings );

    var $area = $( element );
    
    ko.computed( {
      read: function() {
        var opt = {
          tonesStyle: 'checkbox',
          pickerPosition: 'right',
          filterPosition: 'bottom',
          autocomplete: true
        };

        for ( var prop in options ) {
          if ( prop !== 'value' && options.hasOwnProperty( prop ) ) {
            opt[ prop ] = ko.utils.unwrapObservable( options[ prop ] );
          }
        }

        $area.emojioneArea( opt );
      },
      disposeWhenNodeIsRemoved: element
    });

    var changeEventHandler = function() {
      newDO( $area[ 0 ].emojioneArea.getText() );
    };
    var focusEventHandler = function() {
      var focusEvent = document.createEvent( 'Event' );
      focusEvent.initEvent( 'focus', false, false );
      $area[ 0 ].dispatchEvent( focusEvent );
    };

    $area[ 0 ].emojioneArea.on( 'change', changeEventHandler );
    $area[ 0 ].emojioneArea.on( 'focus', focusEventHandler );

    var subscription;
    newDO.subscribe( function ( newValue ) {
      try {
        if ( $area[ 0 ].emojioneArea.getText() != newValue ) {
          $area[ 0 ].emojioneArea.setText( newValue );
        }
      } catch(e) {
        $area[ 0 ].emojioneArea.setText( newValue );
      }
    } );
    ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
      subscription.dispose();
      $area[ 0 ].emojioneArea.off( 'change', focusEventHandler );
      $area[ 0 ].emojioneArea.off( 'focus', focusEventHandler );
    });
  }
};