/**
 * Get the background script and import all configurations and services from it
 */
var bg = chrome.extension.getBackgroundPage(),
    EXTENSION_URL = chrome.extension.getURL(''),
    _ = bg._;

// Import background services
var idb = bg.idb,
    configAPI = bg.configAPI;

/**
 * Initialize th angular application
 */
angular.module('app', [])
    .run(['$rootScope', function ($rootScope) {
        $rootScope.config = bg.config;
        $rootScope.extensionVersion = chrome.app.getDetails().version;
    }])
    .controller('MainCtrl', ['$scope', function ($scope) {
        'use strict';
        var ignoredSite;

        // This is the default mode
        $scope.mode = false;

        // Stats!
        chrome.tabs.query({}, function (tabs) {
            $scope.hibernatingTabs = _.filter(tabs, function (tab) {
                return _.contains(tab.url, EXTENSION_URL);
            });
            $scope.tabs = tabs;
        });

        // Get the active tab and see if it's listed for ignore already
        _.activeTabURL(function (activeTab) {
            $scope.tabURL = activeTab;

            // Get the hostname
            var a = document.createElement("a");
            a.href = activeTab;
            $scope.hostname = a.hostname.replace('www.', '');

            // See if this website is already on the ignore list
            idb.getAll('IGNORED_LIST', function (err, results) {
                if (err) return;

                ignoredSite = _.find(results, function (ignore) {
                    return new RegExp(ignore.regexp).test($scope.tabURL);
                });

                if (ignoredSite) {
                    $scope.mode = ignoredSite.mode;
                    $scope.result = ignoredSite;
                }
                _.digest($scope);
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
                    idb.set('IGNORED_LIST', ignoredSite, function (err, resultID) {
                        if (err) return;

                        ignoredSite.id = resultID;
                    });
                    break;

                case 'page':
                    ignoredSite = {
                        id: ignoredSite ? ignoredSite.id : null,
                        mode: 'page',
                        regexp: $scope.tabURL
                    };
                    idb.set('IGNORED_LIST', ignoredSite, function (err, resultID) {
                        if (err) return;

                        ignoredSite.id = resultID;
                    });
                    break;

                default:
                    if (ignoredSite && ignoredSite.id) {
                        idb.remove('IGNORED_LIST', ignoredSite.id, _.noop);
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
                _.each(extensionTabs, function (tab) {
                    chrome.tabs.sendMessage(tab.id, {action: 'wakeup', tabID: tab.id}, _.noop);
                });
            });
        };
    }]);