(function () {
    'use strict';

    var EXTENSION_URL = chrome.extension.getURL(''),
        tabs_last_active = {};

    // This is on the window so it'll be accessible by hibernating tabs
    window.tabsScreenshots = {};

    /**
     * Init all the services and run the application waterfall
     */
    window.onload = function init() {
        // Initialize services
        configAPI.init(function () {

            if (config.first_run) {
                firstRun();
            }

            // Restore last session
            restoreSession(function () {
                chromeTabEvents();
                scanTabs();
            });
        });
    };

    /**
     * Add some default data when the extension starts for the first time
     */
    function firstRun() {
        // Default websites that should be ignored
        var ignoredSites = [
            {type: 'put', value: {mode: 'hostname', regexp: '(.*)mail.google.com'}},
            {type: 'put', value: {mode: 'hostname', regexp: '(.*)youtube.com'}},
            {type: 'put', value: {mode: 'hostname', regexp: '(.*)facebook.com'}},
            {type: 'put', value: {mode: 'hostname', regexp: '(.*)pandora.com'}},
            {type: 'put', value: {mode: 'hostname', regexp: '(.*)web.whatsapp.com'}},
            {type: 'put', value: {mode: 'hostname', regexp: '(.*)jango.com'}},
            {type: 'put', value: {mode: 'hostname', regexp: '(.*)soundcloud.com'}},
            {type: 'put', value: {mode: 'hostname', regexp: '(.*)twitch.com'}}
        ];

        idb.batch('IGNORED_LIST', ignoredSites, function (err) {
            if (err) return;

            configAPI.set('first_run', false);
        });
    }

    /**
     * If we are back from a chrome update restore the tabs that were closed
     */
    function restoreSession(callback) {
        // Check if we are after update and restore the hibernating tabs from before the update
        if (config.stored_version != chrome.app.getDetails().version) {
            configAPI.set('stored_version', chrome.app.getDetails().version);

            // Prevent same tab from opening twice
            chrome.tabs.query({url: EXTENSION_URL + 'src/app/hibernate.html*'}, function (hibernatingTabs) {
                var urls = hibernatingTabs.map(function (tab) {
                    return tab.url;
                });

                idb.getAll('HIBERNATING_TABS', function (err, hibernating_tabs) {
                    if (err) return callback(err);

                    for (var key in hibernating_tabs) {
                        if (hibernating_tabs.hasOwnProperty(key)) {
                            var tab = hibernating_tabs[key];

                            if (!_contains(urls, tab.url)) {
                                chrome.tabs.create({
                                    url: tab.url,
                                    index: tab.index
                                }, function () {
                                });
                            }
                        }
                    }

                    callback();
                });
            });
        } else {
            callback();
        }
    }

    /**
     * Track events from chrome and act as needed
     */
    function chromeTabEvents() {
        chrome.tabs.onCreated.addListener(function (tab) {
            tabs_last_active[tab.id] = Date.now();
        });

        chrome.tabs.onUpdated.addListener(function (tabID, changeInfo, updatedTab) {
            // Ignore the extension tabs because the event will fire on tabs that are moving to hibernate mode
            if (!_contains(updatedTab.url, EXTENSION_URL)) {
                tabs_last_active[tabID] = Date.now();

                if (!tabsScreenshots[tabID]) {
                    updateTabsScreenshots(function () {
                    });
                }
            }
        });

        // Debounce tabs onActivated and verify the tab is still active
        // for fast navigation between tabs using Ctrl+Tab
        chrome.tabs.onActivated.addListener(function (activeInfo) {
            setTimeout(function () {
                chrome.tabs.get(activeInfo['tabId'], function (tab) {
                    if (tab && tab.active) {
                        tabs_last_active[tab.id] = Date.now();

                        if (_contains(tab.url, EXTENSION_URL) && config.wake_up_on_focus) {
                            // Send message to the tab to wakeup
                            chrome.tabs.sendMessage(tab.id, 'wakeup', function () {
                            });
                        } else {
                            if (!tabsScreenshots[tab.id]) {
                                updateTabsScreenshots(function () {
                                });
                            }
                        }
                    }
                });
            }, 300);
        });

        chrome.tabs.onReplaced.addListener(function (newTabID, oldTabID) {
            tabs_last_active[newTabID] = Date.now();
            delete tabs_last_active[oldTabID];

            tabsScreenshots[newTabID] = tabsScreenshots[oldTabID];
            delete tabsScreenshots[oldTabID];
        });

        chrome.tabs.onRemoved.addListener(function (tabID) {
            delete tabs_last_active[tabID];
            delete tabsScreenshots[tabID];
        });
    }

    /**
     * Scan the tabs and see if we have tabs that need to be put into hibernation
     */
    function scanTabs() {
        idb.getAll('IGNORED_LIST', function (err, ignored_sites) {
            if (err) {
                return setTimeout(scanTabs, config.scan_tabs_interval);
            }

            chrome.tabs.query({}, function (allTabs) {
                async.each(allTabs, function (tab, callback) {
                    // Should we ignore this tab?
                    var ignoreTab = tab.active || _contains(tab.url, EXTENSION_URL);

                    if (!ignoreTab) {
                        for (var key in ignored_sites) {
                            if (ignored_sites.hasOwnProperty(key)) {
                                var site = ignored_sites[key];
                                if (new RegExp(site.regexp).test(tab.url)) {
                                    ignoreTab = true;
                                    break;
                                }
                            }
                        }
                    }

                    // Is it time to hibernate?
                    if (!ignoreTab && tabs_last_active[tab.id] && Date.now() - tabs_last_active[tab.id] > config.auto_hibernate_after * ONE_MINUTE) {
                        hibernateTab(tab, callback);
                    } else {
                        if (!tabs_last_active[tab.id] || tab.active) {
                            tabs_last_active[tab.id] = Date.now();
                        }
                        callback();
                    }
                }, function () {
                    updateTabsScreenshots(function () {
                        storeSession(function () {
                            // Call the scanner again in the time defined
                            setTimeout(scanTabs, config.scan_tabs_interval);
                        });
                    });
                });
            });
        });
    }

    window.hibernateTab = function (tab, callback) {
        // Hibernate page url
        var newURL = EXTENSION_URL + 'src/app/hibernate.html' + _toQueryString(_compactObject({
                tabID: tab.id,
                originalUrl: tab.url,
                favIconUrl: tab.favIconUrl,
                title: tab.title,
                timestamp: Date.now()
            }));

        // Redirect to hibernation page
        chrome.tabs.update(tab.id, {url: newURL}, callback);
    };

    /**
     * Take a screenshot of all the active tabs and only if the setting is turned on.
     */
    function updateTabsScreenshots(callback) {
        if (!config.tab_screenshot) {
            return callback();
        }

        chrome.tabs.query({active: true}, function (activeTabs) {
            async.each(activeTabs, function (tab, callback) {
                if (tab.status == "complete" && !_contains(tab.url, EXTENSION_URL)) {
                    chrome.tabs.captureVisibleTab(tab.windowId, {quality: 60}, function (dataURL) {
                        tabsScreenshots[tab.id] = dataURL;
                        callback();
                    });
                } else {
                    callback();
                }
            }, callback);
        });
    }

    /**
     * Store the current hibernating tabs session for restore after chrome closes or the extension updates
     */
    function storeSession(callback) {
        idb.clear('HIBERNATING_TABS', function (err) {
            if (err) return callback();

            chrome.tabs.query({
                url: EXTENSION_URL + 'src/app/hibernate.html*'
            }, function (allTabs) {
                if (allTabs.length === 0) {
                    return callback();
                }

                var batch = allTabs.map(function (tab) {
                    return {
                        type: 'put',
                        value: {
                            id: tab.id.toString(),
                            url: tab.url,
                            index: tab.index
                        }
                    };
                });
                idb.batch('HIBERNATING_TABS', batch, callback);
            });
        });
    }

    function _toQueryString(params) {
        var arr = [];
        for (var key in params) {
            if (params.hasOwnProperty(key)) {
                arr.push(key + '=' + encodeURIComponent(params[key]));
            }
        }
        var queryString = arr.join('&');
        if (queryString.length > 0) {
            queryString = '?' + queryString;
        }
        return queryString;
    }

    function _compactObject(o) {
        for (var k in o) {
            if (o.hasOwnProperty(k) && !o[k]) {
                delete o[k];
            }
        }
        return o;
    }

    function _contains(hystack, needle) {
        return hystack.indexOf(needle) !== -1;
    }
}());