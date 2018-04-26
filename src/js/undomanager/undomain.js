"use strict";

var ko = require("knockout");
var undoManager = require('./undomanager.js');
var undoserializer = require("./undoserializer.js");

var addUndoStackExtensionMaker = function(performanceAwareCaller) {
  return function(viewModel) {

    viewModel.contentListeners(viewModel.contentListeners() + 2);

    // TODO the labels should be computed observables (needs changes in undomanager projects)
    var undoRedoStack = undoManager(viewModel.content, {
      levels: 100,
      undoLabel: ko.computed(function() { return viewModel.t("Undo (#COUNT#)"); }),
      redoLabel: ko.computed(function() { return viewModel.t("Redo"); })
    });
    viewModel.undo = undoRedoStack.undoCommand;
    viewModel.undo.execute = performanceAwareCaller.bind(viewModel, 'undo', viewModel.undo.execute, undefined);
    viewModel.redo = undoRedoStack.redoCommand;
    viewModel.redo.execute = performanceAwareCaller.bind(viewModel, 'redo', viewModel.redo.execute, undefined);
    viewModel.undoReset = performanceAwareCaller.bind(viewModel, 'undoReset', undoRedoStack.reset, undefined);
    viewModel.setUndoModeMerge = undoRedoStack.setModeMerge;
    viewModel.setUndoModeOnce = undoRedoStack.setModeOnce;
    undoRedoStack.setModeIgnore();
    undoRedoStack.setUndoActionMaker(undoserializer.makeUndoAction.bind(undefined, viewModel.content));
    undoserializer.watchEnabled(true);

    return {
      pause: function() {
        undoRedoStack.setModeIgnore();
      },
      run: function() {
        undoRedoStack.setModeOnce();
      },
      init: function() {
        undoRedoStack.setModeOnce();
      },
      dispose: function() {
        viewModel.contentListeners(viewModel.contentListeners() - 2);
        undoserializer.watchEnabled(false);
        undoRedoStack.dispose();
      }
    };

  };
};

module.exports = addUndoStackExtensionMaker;