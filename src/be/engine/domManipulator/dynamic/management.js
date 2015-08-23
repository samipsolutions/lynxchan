'use strict';

var jsdom = require('jsdom').jsdom;
var serializer = require('jsdom').serializeDocument;
var templateHandler = require('../../templateHandler');
var lang = require('../../langOps').languagePack();
var common = require('..').common;
var boot = require('../../../boot');
var settings = boot.getGeneralSettings();
var debug = boot.debug();
var verbose = settings.verbose;
var miscOps = require('../../miscOps');

var displayMaxBannerSize = common.formatFileSize(settings.maxBannerSizeB);
var displayMaxFlagSize = common.formatFileSize(settings.maxFlagSizeB);

var boardSettingsRelation = {
  disableIds : 'disableIdsCheckbox',
  disableCaptcha : 'disableCaptchaCheckbox',
  forceAnonymity : 'forceAnonymityCheckbox',
  allowCode : 'allowCodeCheckbox',
  archive : 'enableArchiveCheckbox',
  early404 : 'early404Checkbox',
  unindex : 'unindexCheckbox'
};

var boardFieldsRelation = {
  boardNameField : 'boardName',
  tagsField : 'tags',
  boardDescriptionField : 'boardDescription',
  autoCaptchaThresholdField : 'autoCaptchaThreshold',
  hourlyThreadLimitField : 'hourlyThreadLimit',
  anonymousNameField : 'anonymousName'
};

var boardControlIdentifiers = [ 'addVolunteerBoardIdentifier',
    'deletionIdentifier', 'transferBoardIdentifier', 'boardSettingsIdentifier',
    'customCssIdentifier', 'customSpoilerIdentifier' ];

var boardManagementLinks = [ {
  page : 'closedReports',
  element : 'closedReportsLink'
}, {
  page : 'bans',
  element : 'bansLink'
}, {
  page : 'bannerManagement',
  element : 'bannerManagementLink'
}, {
  page : 'filterManagement',
  element : 'filterManagementLink'
}, {
  page : 'rangeBans',
  element : 'rangeBansLink'
}, {
  page : 'rules',
  element : 'ruleManagementLink'
}, {
  page : 'hashBans',
  element : 'hashBansLink'
}, {
  page : 'flags',
  element : 'flagManagementLink'
} ];

var siteSettingsRelation = {

  fieldAddress : {
    setting : 'address',
    type : 'string'
  },
  fieldPort : {
    setting : 'port',
    type : 'string'
  },
  fieldFePath : {
    setting : 'fePath',
    type : 'string'
  },
  fieldPageSize : {
    setting : 'pageSize',
    type : 'string'
  },
  fieldLatestPostsCount : {
    setting : 'latestPostCount',
    type : 'string'
  },
  fieldAutoSageLimit : {
    setting : 'autoSageLimit',
    type : 'string'
  },
  fieldThreadLimit : {
    setting : 'maxThreadCount',
    type : 'string'
  },
  fieldSiteTitle : {
    setting : 'siteTitle',
    type : 'string'
  },
  fieldTempDir : {
    setting : 'tempDirectory',
    type : 'string'
  },
  fieldSenderEmail : {
    setting : 'emailSender',
    type : 'string'
  },
  fieldCaptchaExpiration : {
    setting : 'captchaExpiration',
    type : 'string'
  },
  fieldMaxRequestSize : {
    setting : 'maxRequestSizeMB',
    type : 'string'
  },
  fieldMaxFileSize : {
    setting : 'maxFileSizeMB',
    type : 'string'
  },
  fieldMaxFiles : {
    setting : 'maxFiles',
    type : 'string'
  },
  fieldBanMessage : {
    setting : 'defaultBanMessage',
    type : 'string'
  },
  fieldLogPageSize : {
    setting : 'logPageSize',
    type : 'string'
  },
  fieldAnonymousName : {
    setting : 'defaultAnonymousName',
    type : 'string'
  },
  fieldTopBoardsCount : {
    setting : 'topBoardsCount',
    type : 'string'
  },
  fieldBoardsPerPage : {
    setting : 'boardsPerPage',
    type : 'string'
  },
  fieldTorSource : {
    setting : 'torSource',
    type : 'string'
  },
  fieldLanguagePack : {
    setting : 'languagePackPath',
    type : 'string'
  },
  fieldMaxRules : {
    setting : 'maxBoardRules',
    type : 'string'
  },
  fieldThumbSize : {
    setting : 'thumbSize',
    type : 'string'
  },
  fieldMaxTags : {
    setting : 'maxBoardTags',
    type : 'string'
  },
  fieldMaxFilters : {
    setting : 'maxFilters',
    type : 'string'
  },
  fieldMaxVolunteers : {
    setting : 'maxBoardVolunteers',
    type : 'string'
  },
  fieldMaxBannerSize : {
    setting : 'maxBannerSizeKB',
    type : 'string'
  },
  fieldMaxFlagSize : {
    setting : 'maxFlagSizeKB',
    type : 'string'
  },
  fieldFloodInterval : {
    setting : 'floodTimerSec',
    type : 'string'
  },
  checkboxVerbose : {
    setting : 'verbose',
    type : 'boolean'
  },
  checkboxDisable304 : {
    setting : 'disable304',
    type : 'boolean'
  },
  checkboxSsl : {
    setting : 'ssl',
    type : 'boolean'
  },
  checkboxBlockTor : {
    setting : 'blockTor',
    type : 'boolean'
  },
  checkboxMediaThumb : {
    setting : 'mediaThumb',
    type : 'boolean'
  },
  checkboxMaintenance : {
    setting : 'maintenance',
    type : 'boolean'
  },
  checkboxMultipleReports : {
    setting : 'multipleReports',
    type : 'boolean'
  },
  checkboxBlockProxy : {
    setting : 'blockProxy',
    type : 'boolean'
  },
  checkboxDisableFloodCheck : {
    setting : 'disableFloodCheck',
    type : 'boolean'
  },
  checkboxServeArchive : {
    setting : 'serveArchive',
    type : 'boolean'
  },
  checkboxDisableAccountCreation : {
    setting : 'disableAccountCreation',
    type : 'boolean'
  },
  checkboxRestrictBoardCreation : {
    setting : 'restrictBoardCreation',
    type : 'boolean'
  },
  fieldCaptchaFonts : {
    setting : 'captchaFonts',
    type : 'array'
  },
  fieldAcceptedMimes : {
    setting : 'acceptedMimes',
    type : 'array'
  },
  comboArchive : {
    setting : 'archiveLevel',
    type : 'combo',
    options : lang.guiArchiveLevels
  }
};

exports.bannerManagement = function(boardUri, banners) {

  try {

    var document = jsdom(templateHandler.bannerManagementPage);

    document.title = lang.titBanners.replace('{$board}', boardUri);

    document.getElementById('maxSizeLabel').innerHTML = displayMaxBannerSize;

    document.getElementById('boardIdentifier').setAttribute('value', boardUri);

    var bannerDiv = document.getElementById('bannersDiv');

    for (var i = 0; i < banners.length; i++) {
      var banner = banners[i];

      var cell = document.createElement('form');
      cell.innerHTML = templateHandler.bannerCell;

      common.setFormCellBoilerPlate(cell, '/deleteBanner.js', 'bannerCell');

      cell.getElementsByClassName('bannerImage')[0].src = banner.filename;

      cell.getElementsByClassName('bannerIdentifier')[0].setAttribute('value',
          banner._id);

      bannerDiv.appendChild(cell);
    }

    return serializer(document);

  } catch (error) {
    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();

  }

};

// Section 1: Board control {
function setBoardControlCheckBoxes(document, boardData) {

  var settings = boardData.settings;

  for (var i = 0; i < settings.length; i++) {
    var setting = settings[i];
    document.getElementById(boardSettingsRelation[setting]).setAttribute(
        'checked', true);
  }

}

function setBoardFields(document, boardData) {

  for ( var key in boardFieldsRelation) {

    document.getElementById(key).setAttribute('value',
        boardData[boardFieldsRelation[key]] || '');
  }

  var messageContent = boardData.boardMessage || '';

  document.getElementById('boardMessageField').defaultValue = messageContent;

}

function setVolunteersDiv(document, boardData) {
  var volunteersDiv = document.getElementById('volunteersDiv');

  var volunteers = boardData.volunteers || [];

  for (var i = 0; i < volunteers.length; i++) {

    var cell = document.createElement('form');
    cell.innerHTML = templateHandler.volunteerCell;

    common.setFormCellBoilerPlate(cell, '/setVolunteer.js', 'volunteerCell');

    cell.getElementsByClassName('userIdentifier')[0].setAttribute('value',
        volunteers[i]);

    cell.getElementsByClassName('userLabel')[0].innerHTML = volunteers[i];

    cell.getElementsByClassName('boardIdentifier')[0].setAttribute('value',
        boardData.boardUri);

    volunteersDiv.appendChild(cell);
  }
}

function setBoardOwnerControls(document, boardData) {

  for (var i = 0; i < boardControlIdentifiers.length; i++) {
    document.getElementById(boardControlIdentifiers[i]).setAttribute('value',
        boardData.boardUri);
  }

  if (!boardData.usesCustomSpoiler) {
    common.removeElement(document.getElementById('customSpoilerIndicator'));
  }

  setBoardControlCheckBoxes(document, boardData);

  setVolunteersDiv(document, boardData);

}

function setBoardManagementLinks(document, boardData) {

  for (var i = 0; i < boardManagementLinks.length; i++) {
    var link = boardManagementLinks[i];

    var url = '/' + link.page + '.js?boardUri=' + boardData.boardUri;
    document.getElementById(link.element).href = url;

  }

}

exports.boardManagement = function(login, boardData, reports) {

  try {

    var document = jsdom(templateHandler.bManagement);

    document.title = lang.titBoardManagement.replace('{$board}',
        boardData.boardUri);

    setBoardManagementLinks(document, boardData);

    setBoardFields(document, boardData);

    var boardLabel = document.getElementById('boardLabel');

    var label = '/' + boardData.boardUri + '/ - ' + boardData.boardName;
    boardLabel.innerHTML = label;

    common.setReportList(document, reports);

    if (login === boardData.owner) {
      setBoardOwnerControls(document, boardData);
    } else {
      common.removeElement(document.getElementById('ownerControlDiv'));
    }

    return serializer(document);

  } catch (error) {
    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();
  }

};
// } Section 1: Board control

// Section 2: Global Management {
function setRoleComboBox(document, node, possibleRoles, user) {
  for (var k = 0; k < possibleRoles.length; k++) {

    var role = possibleRoles[k];

    var option = document.createElement('option');
    option.value = role.value;
    option.innerHTML = role.label;

    if (role.value === user.globalRole) {
      option.setAttribute('selected', 'selected');
    }

    node.add(option);

  }

}

function fillStaffDiv(document, possibleRoles, staff) {
  var divStaff = document.getElementById('divStaff');

  for (var i = 0; i < staff.length; i++) {

    var user = staff[i];

    var cell = document.createElement('form');
    cell.innerHTML = templateHandler.staffCell;

    common.setFormCellBoilerPlate(cell, '/setGlobalRole.js', 'staffCell');

    cell.getElementsByClassName('userIdentifier')[0].setAttribute('value',
        user.login);

    cell.getElementsByClassName('userLabel')[0].innerHTML = user.login + ': ';

    setRoleComboBox(document, cell.getElementsByClassName('roleCombo')[0],
        possibleRoles, user);

    divStaff.appendChild(cell);

  }
}

function getPossibleRoles(role) {

  var roles = [];

  for (var i = role + 1; i <= miscOps.getMaxStaffRole() + 1; i++) {
    var toPush = {
      value : i,
      label : miscOps.getGlobalRoleLabel(i)
    };

    roles.push(toPush);

  }

  return roles;
}

function setNewStaffComboBox(document, userRole) {

  var comboBox = document.getElementById('newStaffCombo');

  for (var i = userRole + 1; i <= miscOps.getMaxStaffRole(); i++) {

    var option = document.createElement('option');
    option.value = i;
    option.innerHTML = miscOps.getGlobalRoleLabel(i);

    comboBox.add(option);
  }

}

function setGlobalManagementLinks(userRole, document) {

  var displayBans = userRole < miscOps.getMaxStaffRole();

  if (!displayBans) {
    common.removeElement(document.getElementById('hashBansLink'));
    common.removeElement(document.getElementById('rangeBansLink'));
    common.removeElement(document.getElementById('bansLink'));
  }

  if (userRole !== 0) {
    common.removeElement(document.getElementById('globalSettingsLink'));
  }

  var deleteArchive = userRole < 2;

  if (!deleteArchive) {
    common.removeElement(document.getElementById('archiveDeletionLink'));
  }
}

exports.globalManagement = function(userRole, userLogin, staff, reports) {

  try {
    var document = jsdom(templateHandler.gManagement);

    document.title = lang.titGlobalManagement;

    common.setReportList(document, reports);

    setGlobalManagementLinks(userRole, document);

    if (userRole < 2) {
      setNewStaffComboBox(document, userRole);
    } else {
      common.removeElement(document.getElementById('addStaffForm'));
    }

    var userLabel = document.getElementById('userLabel');

    var userLabelContent = userLogin + ': ';
    userLabelContent += miscOps.getGlobalRoleLabel(userRole);

    userLabel.innerHTML = userLabelContent;

    fillStaffDiv(document, getPossibleRoles(userRole), staff);

    return serializer(document);
  } catch (error) {

    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();
  }
};
// } Section 2: Global Management

// Section 3: Filter management {

function setFilterCell(cell, boardUri, filter) {

  var labelOriginal = cell.getElementsByClassName('labelOriginal')[0];
  labelOriginal.innerHTML = filter.originalTerm;

  var labelReplacement = cell.getElementsByClassName('labelReplacement')[0];
  labelReplacement.innerHTML = filter.replacementTerm;

  var filterIdentifier = cell.getElementsByClassName('filterIdentifier')[0];
  filterIdentifier.setAttribute('value', filter.originalTerm);

  var boardIdentifier = cell.getElementsByClassName('boardIdentifier')[0];
  boardIdentifier.setAttribute('value', boardUri);
}

exports.filterManagement = function(boardUri, filters) {

  try {

    var document = jsdom(templateHandler.filterManagement);

    document.title = lang.titFilters.replace('{$board}', boardUri);

    document.getElementById('boardIdentifier').setAttribute('value', boardUri);

    var filtersDiv = document.getElementById('divFilters');

    for (var i = 0; i < filters.length; i++) {

      var filter = filters[i];

      var filterCell = document.createElement('form');
      filterCell.innerHTML = templateHandler.filterCell;

      common.setFormCellBoilerPlate(filterCell, '/deleteFilter.js',
          'filterCell');

      setFilterCell(filterCell, boardUri, filter);

      filtersDiv.appendChild(filterCell);
    }

    return serializer(document);

  } catch (error) {
    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();
  }

};
// } Section 3: Filter management

// Section 4: Rule management {
function setRuleManagementCells(document, boardUri, rules) {
  var rulesDiv = document.getElementById('divRules');

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];

    var cell = document.createElement('form');
    common.setFormCellBoilerPlate(cell, '/deleteRule.js', 'ruleManagementCell');
    cell.innerHTML = templateHandler.ruleManagementCell;
    cell.getElementsByClassName('textLabel')[0].innerHTML = rule;

    cell.getElementsByClassName('boardIdentifier')[0].setAttribute('value',
        boardUri);
    cell.getElementsByClassName('indexIdentifier')[0].setAttribute('value', i);

    rulesDiv.appendChild(cell);
  }
}

exports.ruleManagement = function(boardUri, rules) {

  try {

    var document = jsdom(templateHandler.ruleManagementPage);

    document.title = lang.titRuleManagement;

    var boardIdentifier = document.getElementById('boardIdentifier');

    boardIdentifier.setAttribute('value', boardUri);

    setRuleManagementCells(document, boardUri, rules);

    return serializer(document);

  } catch (error) {
    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();
  }

};
// } Section 4: Rule management

// Section 5: Flag management {
function addFlagCells(document, flags, boardUri) {

  var flagsDiv = document.getElementById('flagsDiv');

  for (var i = 0; i < flags.length; i++) {
    var flag = flags[i];

    var cell = document.createElement('form');

    common.setFormCellBoilerPlate(cell, '/deleteFlag.js', 'flagCell');

    cell.innerHTML = templateHandler.flagCell;

    var flagUrl = '/' + boardUri + '/flags/' + flag._id;

    cell.getElementsByClassName('flagImg')[0].src = flagUrl;

    cell.getElementsByClassName('idIdentifier')[0].setAttribute('value',
        flag._id);

    cell.getElementsByClassName('nameLabel')[0].innerHTML = flag.name;

    flagsDiv.appendChild(cell);
  }

}

exports.flagManagement = function(boardUri, flags, callback) {
  try {

    var document = jsdom(templateHandler.flagsPage);

    document.title = lang.titFlagManagement;

    document.getElementById('maxSizeLabel').innerHTML = displayMaxFlagSize;

    document.getElementById('boardIdentifier').setAttribute('value', boardUri);

    addFlagCells(document, flags, boardUri);

    return serializer(document);
  } catch (error) {
    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();
  }

};

// } Section 5: Flag management

// Section 6: Global settings {
function setComboSetting(document, element, setting) {

  for (var i = 0; i < setting.options.length; i++) {

    var option = document.createElement('option');
    option.value = i;
    option.innerHTML = setting.options[i];

    if (i === settings[setting.setting]) {
      option.setAttribute('selected', 'selected');
    }

    element.appendChild(option);
  }
}

exports.globalSettings = function(settings) {

  try {

    var document = jsdom(templateHandler.globalSettingsPage);

    for ( var key in siteSettingsRelation) {

      var setting = siteSettingsRelation[key];

      var element = document.getElementById(key);

      switch (setting.type) {
      case 'string':
        element.setAttribute('value', settings[setting.setting] || '');
        break;
      case 'boolean':
        if (settings[setting.setting]) {
          element.setAttribute('checked', true);
        }
        break;

      case 'array':
        element.setAttribute('value', (settings[setting.setting] || '')
            .toString());
        break;
      case 'combo':
        setComboSetting(document, element, setting);
        break;
      }

    }

    document.title = lang.titGlobalSettings;

    return serializer(document);

  } catch (error) {
    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

    return error.toString();
  }
};
// } Section 6: Global settings
