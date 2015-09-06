'use strict';

var db = require('../../db');
var boards = db.boards();
var files = db.files();
var posts = db.posts();
var threads = db.threads();
var logger = require('../../logger');
var boot = require('../../boot');
var debug = boot.debug();
var settings = boot.getGeneralSettings();
var verbose = settings.verbose;
var bumpLimit = settings.autoSageLimit;
var common = require('.').common;
var refuseTorFiles = settings.torAccess < 2;
var refuseProxyFiles = settings.proxyAccess < 2;
var gsHandler;
var generator;
var uploadHandler;
var lang;
var miscOps;
var captchaOps;

var latestPostsCount = settings.latestPostCount;
var bumpLimit = settings.autoSageLimit;
var autoLockLimit = bumpLimit * 2;

exports.loadDependencies = function() {

  gsHandler = require('../gridFsHandler');
  generator = require('../generator');
  uploadHandler = require('../uploadHandler');
  lang = require('../langOps').languagePack();
  miscOps = require('../miscOps');
  captchaOps = require('../captchaOps');

};

function cleanPostFiles(files, postId, callback) {

  gsHandler.removeFiles(files, function removedFiles(error) {
    callback(error, postId);
  });

}

function updateThreadAfterCleanUp(boardUri, threadId, removedPosts, postId,
    removedFileCount, callback) {

  threads.updateOne({
    boardUri : boardUri,
    threadId : threadId
  }, {
    $inc : {
      postCount : -removedPosts.length,
      fileCount : -removedFileCount
    }
  }, function updatedThread(error) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      files.aggregate([ {
        $match : {
          'metadata.boardUri' : boardUri,
          'metadata.postId' : {
            $in : removedPosts
          }
        }
      }, {
        $group : {
          _id : 0,
          files : {
            $push : '$filename'
          }
        }
      } ], function gotFileNames(error, results) {
        if (error) {
          callback(error);
        } else if (!results.length) {
          callback(null, postId);
        } else {
          cleanPostFiles(results[0].files, postId, callback);
        }

      });
      // style exception, too simple

    }

  });

}

function cleanThreadPosts(boardUri, threadId, postId, callback) {

  posts.aggregate([ {
    $match : {
      boardUri : boardUri,
      threadId : threadId
    }
  }, {
    $sort : {
      creation : -1
    }
  }, {
    $skip : bumpLimit
  }, {
    $group : {
      _id : 0,
      posts : {
        $push : '$postId'
      },
      removedFileCount : {
        $sum : {
          $size : {
            $ifNull : [ '$files', [] ]
          }
        }
      }
    }
  } ], function gotPosts(error, results) {
    if (error) {
      callback(error);
    } else if (!results.length) {
      callback(null, postId);
    } else {
      var postsToDelete = results[0].posts;

      // style exception, too simple
      posts.deleteMany({
        boardUri : boardUri,
        postId : {
          $in : postsToDelete
        }
      }, function postsRemoved(error) {
        if (error) {
          callback(error);
        } else {
          updateThreadAfterCleanUp(boardUri, threadId, postsToDelete, postId,
              results[0].removedFileCount, callback);
        }
      });
      // style exception, too simple
    }

  });

}

function updateBoardForPostCreation(parameters, postId, thread, cleanPosts,
    callback) {

  if (parameters.email !== 'sage') {

    for (var i = 0; i < (thread.page || 1); i++) {

      // signal rebuild of board pages
      process.send({
        board : parameters.boardUri,
        page : i + 1
      });
    }
  } else if (thread.page) {
    process.send({
      board : parameters.boardUri,
      page : thread.page
    });
  }

  // signal rebuild of thread
  process.send({
    board : parameters.boardUri,
    thread : parameters.threadId
  });

  // signal rebuild of board
  process.send({
    board : parameters.boardUri,
    catalog : true
  });

  common.addPostToStats(parameters.boardUri, function updatedStats(error) {
    if (error) {
      console.log(error.toString());
    }

    if (cleanPosts) {
      cleanThreadPosts(parameters.boardUri, parameters.threadId, postId,
          callback);
    } else {
      callback(error, postId);
    }

  });

}

function getLatestPosts(thread, postId) {
  var latestPosts = thread.latestPosts || [];

  latestPosts.push(postId);

  latestPosts = latestPosts.sort(function compareNumbers(a, b) {
    return a - b;
  });

  if (latestPosts.length > latestPostsCount) {
    latestPosts.splice(0, latestPosts.length - latestPostsCount);
  }

  return latestPosts;

}

function updateThread(parameters, postId, thread, callback, post) {

  var updateBlock = {
    $set : {
      latestPosts : getLatestPosts(thread, postId)
    },
    $inc : {
      postCount : 1
    }
  };

  var cleanPosts = false;
  var saged = parameters.email === 'sage';
  var bump = false;

  if (!thread.autoSage) {

    if (thread.postCount >= bumpLimit) {

      if (thread.cyclic) {
        cleanPosts = true;
        bump = true;
      } else {
        updateBlock.$set.autoSage = true;
      }

    } else {
      bump = true;
    }

  }

  if (!saged && bump) {
    updateBlock.$set.lastBump = new Date();
  }

  threads.update({
    boardUri : parameters.boardUri,
    threadId : parameters.threadId
  }, updateBlock, function updatedThread(error, result) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      generator.preview(null, null, null, function generatedPreview(error) {
        if (error) {
          callback(error);
        } else {
          updateBoardForPostCreation(parameters, postId, thread, cleanPosts,
              callback);
        }
      }, post);
      // style exception, too simple

    }

  });

}

function createPost(req, parameters, userData, postId, thread, board,
    wishesToSign, cb) {

  var ip = logger.ip(req);

  var hideId = board.settings.indexOf('disableIds') > -1;

  var id = hideId ? null : common
      .createId(thread.salt, parameters.boardUri, ip);

  var nameToUse = parameters.name || board.anonymousName;
  nameToUse = nameToUse || common.defaultAnonymousName;

  var postToAdd = {
    boardUri : parameters.boardUri,
    postId : postId,
    markdown : parameters.markdown,
    ip : ip,
    threadId : parameters.threadId,
    signedRole : common.getSignedRole(userData, wishesToSign, board),
    creation : new Date(),
    subject : parameters.subject,
    name : nameToUse,
    id : id,
    message : parameters.message,
    email : parameters.email
  };

  if (parameters.flag) {
    postToAdd.flagName = parameters.flagName;
    postToAdd.flag = parameters.flag;
  }

  if (parameters.password) {
    postToAdd.password = parameters.password;
  }

  posts.insert(postToAdd, function createdPost(error) {
    if (error) {
      cb(error);
    } else {

      if (!req.isTor && !req.isProxy) {
        common.recordFlood(ip);
      }

      var refuseFiles = req.isTor && refuseTorFiles;
      refuseFiles = refuseFiles || req.isProxy && refuseProxyFiles;

      if (!refuseFiles) {
        // style exception, too simple
        uploadHandler.saveUploads(board, parameters.threadId, postId,
            parameters, function savedFiles(error) {
              if (error) {
                if (verbose) {
                  console.log(error);
                }

                if (debug) {
                  throw error;
                }
              }
              updateThread(parameters, postId, thread, cb, postToAdd);

            });
        // style exception, too simple
      } else {
        updateThread(parameters, postId, thread, cb, postToAdd);
      }

    }
  });

}

function getPostFlag(req, parameters, userData, postId, thread, board,
    wishesToSign, cb) {

  common.getFlagUrl(parameters.flag, parameters.boardUri, function gotFlagUrl(
      flagUrl, flagName) {

    parameters.flagName = flagName;
    parameters.flag = flagUrl;

    createPost(req, parameters, userData, postId, thread, board, wishesToSign,
        cb);
  });

}

function getPostMarkdown(req, parameters, userData, thread, board, callback) {

  var wishesToSign = common.doesUserWishesToSign(userData, parameters);

  parameters.message = common.applyFilters(board.filters, parameters.message);

  common.markdownText(parameters.message, parameters.boardUri, board.settings
      .indexOf('allowCode') > -1, function gotMarkdown(error, markdown) {

    if (error) {
      callback(error);
    } else {
      parameters.markdown = markdown;

      // style exception, too simple
      boards.findOneAndUpdate({
        boardUri : parameters.boardUri
      }, {
        $inc : {
          lastPostId : 1
        }
      }, {
        returnOriginal : false
      }, function gotNewId(error, lastIdData) {
        if (error) {
          callback(error);
        } else {
          getPostFlag(req, parameters, userData, lastIdData.value.lastPostId,
              thread, board, wishesToSign, callback);
        }
      });
      // style exception, too simple

    }

  });

}

function getThread(req, parameters, userData, board, callback) {

  threads.findOne({
    boardUri : parameters.boardUri,
    threadId : parameters.threadId
  }, {
    _id : 1,
    salt : 1,
    page : 1,
    cyclic : 1,
    locked : 1,
    autoSage : 1,
    postCount : 1,
    latestPosts : 1
  }, function gotThread(error, thread) {
    if (error) {
      callback(error);
    } else if (!thread) {
      callback(lang.errThreadNotFound);
    } else if (thread.locked) {
      callback(lang.errThreadLocked);
    } else if (thread.postCount >= autoLockLimit) {
      callback(lang.errThreadAutoLocked);
    } else {

      if (board.settings.indexOf('forceAnonymity') > -1) {
        parameters.name = null;
      }

      miscOps.sanitizeStrings(parameters, common.postingParameters);

      // style exception, too simple
      common.checkForTripcode(parameters, function setTripCode(error,
          parameters) {
        if (error) {
          callback(error);
        } else {
          getPostMarkdown(req, parameters, userData, thread, board, callback);
        }
      });
      // style exception, too simple

    }
  });

}

exports.newPost = function(req, userData, parameters, captchaId, callback) {

  parameters.threadId = +parameters.threadId;

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    _id : 0,
    filters : 1,
    owner : 1,
    boardUri : 1,
    usesCustomSpoiler : 1,
    anonymousName : 1,
    settings : 1,
    volunteers : 1
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else {

      // style exception, too simple
      captchaOps.attemptCaptcha(captchaId, parameters.captcha, board,
          function solvedCaptcha(error) {

            if (error) {
              callback(error);
            } else {
              getThread(req, parameters, userData, board, callback);
            }

          });
      // style exception, too simple

    }
  });

};