'use strict';

var dns = require('dns');
var fs = require('fs');
var exec = require('child_process').exec;
var logger = require('../logger');
var command = 'curl -s {$host} | gunzip -';
var ipLineSize = 4;
var ipSource;
var incrementalIpSource;
var disabled;
var locationOps;
var dnsbl;

exports.loadDependencies = function() {
  locationOps = require('./locationOps');
};

exports.loadSettings = function() {
  var settings = require('../settingsHandler').getGeneralSettings();

  dnsbl = settings.dnsbl;
  disabled = settings.disableSpamCheck;
  incrementalIpSource = settings.incSpamIpsSource;
  ipSource = settings.spamIpsSource;
};

exports.spamDataPath = __dirname + '/../spamData';

exports.parseIpBuffer = function(buffer) {

  var array = Array(4);

  for (var i = 0; i < 4; i++) {
    array[i] = buffer[i];
  }

  return {
    ip : array
  };

};

// Section 1: Updating spammer list {
exports.getSortedIps = function(ips) {

  var foundIps = [];

  for (var i = 0; i < ips.length; i++) {
    var ip = ips[i].trim();

    if (!ip) {
      continue;
    }

    foundIps.push(logger.convertIpToArray(ip));
  }

  return foundIps.sort(logger.compareArrays);

};

exports.processData = function(foundIps, callback) {

  var fileStream = fs.createWriteStream(exports.spamDataPath);

  var stopped = false;

  fileStream.once('error', function(error) {
    stopped = true;
    callback(error);
  });

  for (var i = 0; i < foundIps.length; i++) {

    if (stopped) {
      return;
    }

    fileStream.write(Buffer.from(foundIps[i]));

  }

  if (stopped) {
    return;
  }

  fileStream.end(callback);

};

exports.updateSpammers = function(callback) {

  exec(command.replace('{$host}', ipSource), {
    maxBuffer : Infinity
  }, function gotData(error, data) {

    if (error) {
      callback(error);
    } else {
      exports.processData(exports.getSortedIps(data.split(',')), callback);
    }

  });

};
// } Section 1: Updating spammer list

// Section 2: Checking ip {
exports.checkIp = function(ip, callback, override) {

  if (disabled && !override) {
    callback();
    return;
  }

  logger.binarySearch({
    ip : ip
  }, exports.spamDataPath, ipLineSize, function compare(a, b) {
    return logger.compareArrays(a.ip, b.ip);
  }, exports.parseIpBuffer, function searched(error, ip) {

    if (error) {
      callback(error);
    } else {
      callback(null, !!ip);
    }

  });

};

exports.checkDnsbl = function(ip, callback) {

  if (!dnsbl) {
    return exports.checkIp(ip, callback);
  }

  var address = dnsbl;

  for (var i = 0; i < ip.length; i++) {

    if (ip.length === 4) {
      address = ip[i] + '.' + address;
    } else {

      var hex = ip[i].toString(16);

      if (hex.length < 2) {
        hex = '0' + hex;
      }

      address = hex[1] + '.' + hex[0] + '.' + address;

    }

  }

  dns.resolve(address, function(error, data) {

    if ((error && error.code !== 'ENOTFOUND') || data) {
      callback(error, !!data);
    } else {
      exports.checkIp(ip, callback);
    }

  });

};
// } Section 2: Checking ip

// Section 3: Incrementing spammer list {
exports.iterateNewIps = function(newIps, currentArray, callback, index,
    inserted) {

  index = index || 0;

  if (index >= newIps.length) {

    if (inserted) {
      exports.processData(currentArray.sort(logger.compareArrays), callback);
    } else {
      callback();
    }

    return;
  }

  var ipString = newIps[index];

  if (!ipString.length) {
    exports.iterateNewIps(newIps, currentArray, callback, ++index, inserted);
    return;
  }

  var ip = logger.convertIpToArray(ipString);

  exports.checkIp(ip, function checked(error, spammer) {

    if (error) {
      callback(error);
    } else {

      if (!spammer) {
        inserted = true;
        currentArray.push(ip);
      }

      exports.iterateNewIps(newIps, currentArray, callback, ++index, inserted);

    }

  }, true);

};

exports.incrementSpammers = function(callback) {

  exec(command.replace('{$host}', incrementalIpSource), {
    maxBuffer : Infinity
  }, function gotData(error, data) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      fs.readFile(exports.spamDataPath, function gotExistingData(error,
          existingData) {
        if (error) {
          callback(error);
        } else {

          var currentArray = [];

          for (var i = 0; i < existingData.length / 4; i++) {

            var offset = i * 4;

            var toAdd = Array(4);

            for (var j = 0; j < 4; j++) {
              toAdd[j] = existingData[j + offset];
            }

            currentArray.push(toAdd);

          }

          exports.iterateNewIps(data.split('\n'), currentArray, callback);
        }
      });
      // style exception, too simple

    }

  });

};
// } Section 3: Incrementing spammer list

exports.init = function(callback) {

  try {
    fs.statSync(exports.spamDataPath);
    callback();
  } catch (error) {
    if (error.code === 'ENOENT') {
      exports.updateSpammers(callback);
    } else {
      callback(error);
    }

  }

};