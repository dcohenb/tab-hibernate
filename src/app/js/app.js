'use strict';

angular.module('app', [])
    .constant('bg', chrome.extension.getBackgroundPage())
    .run(['$rootScope', 'bg', function ($rootScope, bg) {
        $rootScope.config = bg.config;
        $rootScope.extensionVersion = chrome.app.getDetails().version;
    }])
    .service('configAPI', ['bg', function (bg) {
        var configAPI = bg.configAPI;

        function set(key, value) {
            configAPI.set(key, value);
        }

        return {
            set: set
        }
    }])
    .service('idb', ['$q', 'bg', function ($q, bg) {
        var idb = bg.idb;

        function getAll(table) {
            return $q(function (resolve, reject) {
                idb.getAll(table, function (err, results) {
                    if (err) return reject(err);
                    resolve(results);
                });
            });
        }

        function set(table, objectData) {
            return $q(function (resolve, reject) {
                idb.set(table, objectData, function (err, results) {
                    if (err) return reject(err);
                    resolve(results);
                });
            });
        }

        function remove(table, objectID) {
            return $q(function (resolve, reject) {
                idb.set(table, objectID, function (err, results) {
                    if (err) return reject(err);
                    resolve(results);
                });
            });
        }

        return {
            getAll: getAll,
            set: set,
            remove: remove
        }
    }])
    .controller('MainCtrl', ['$scope', '$q', 'idb', 'configAPI', function ($scope, $q, idb, configAPI) {
        var ignoredSite,
            EXTENSION_URL = chrome.extension.getURL('');

        // This is the default mode
        $scope.mode = false;

        // Stats!
        chrome.tabs.query({}, function (tabs) {
            $scope.hibernatingTabs = tabs.filter(function (tab) {
                return tab.url.indexOf(EXTENSION_URL) !== -1;
            });
            $scope.tabs = tabs;
        });

        // Get the active tab and see if it's listed for ignore already
        _activeTabURL().then(function (activeTab) {
            $scope.tabURL = activeTab;

            // Get the hostname
            var a = document.createElement("a");
            a.href = activeTab;
            $scope.hostname = a.hostname.replace('www.', '');

            // See if this website is already on the ignore list
            idb.getAll('IGNORED_LIST').then(function (results) {
                for (var key in results) {
                    if (!results.hasOwnProperty(key)) continue;

                    var ignore = results[key];
                    if (new RegExp(ignore.regexp).test($scope.tabURL)) {
                        $scope.mode = ignore.mode;
                        $scope.result = ignore;
                        break;
                    }
                }
            });
        });

        // watch for changes in the form and update accordingly
        $scope.modeChangeHandler = function () {
            switch ($scope.mode) {
                case 'hostname':
                    ignoredSite = {
                        id: ignoredSite ? ignoredSite.id : null,
                        mode: 'hostname',
                        regexp: '(.*)' + $scope.hostname
                    };
                    idb.set('IGNORED_LIST', ignoredSite).then(function (resultID) {
                        ignoredSite.id = resultID;
                    });
                    break;

                case 'page':
                    ignoredSite = {
                        id: ignoredSite ? ignoredSite.id : null,
                        mode: 'page',
                        regexp: $scope.tabURL
                    };
                    idb.set('IGNORED_LIST', ignoredSite).then(function (resultID) {
                        ignoredSite.id = resultID;
                    });
                    break;

                default:
                    if (ignoredSite && ignoredSite.id) {
                        idb.remove('IGNORED_LIST', ignoredSite.id);
                    }
                    break;
            }
        };

        // Settings update
        $scope.settingsUpdate = function (key, val) {
            configAPI.set(key, val);
        };

        // send a wakeup request to all tabs
        $scope.wakeupAll = function () {
            chrome.tabs.query({url: EXTENSION_URL + 'src/app/hibernate.html*'}, function (extensionTabs) {
                extensionTabs.forEach(function (tab) {
                    chrome.tabs.sendMessage(tab.id, {action: 'wakeup', tabID: tab.id}, function () {
                    });
                });
            });
        };

        // Query chrome for the current open website the user is focused on
        function _activeTabURL() {
            return $q(function (resolve, reject) {
                chrome.tabs.query({active: true}, function (tabs) {
                    if (tabs.length === 0) return reject();
                    var tab = tabs[0];
                    var result = tab.url;

                    // If the tab is hibernating extract the original page url from the params
                    if (result.indexOf(chrome.app.getDetails().id) !== -1) {
                        var params = {};
                        tab.url.split('?')[1].split('&').forEach(function (param) {
                            var a = param.split('=');
                            params[a[0]] = a[1];
                        });
                        result = decodeURIComponent(params.originalUrl);
                    }

                    resolve(result);
                });
            });
        }
    }]);