(function () {
    var bg = chrome.extension.getBackgroundPage(),
        params = {};

    /**
     * Start the app
     */
    function init() {
        // Breakdown the query string to variables in params
        window.location.search.replace('?', '').split('&').forEach(function (item) {
            var key = item.split('=')[0];
            params[key] = decodeURIComponent(item.split('=')[1]).replace(/\+/g, ' ');
        });

        // ------------ Events ------------
        // When a tab is activated, check if it's this tab, debounce,
        // check again that it's still active, and if it is then wake it up.
        chrome.tabs.getCurrent(function (originalTab) {
            chrome.tabs.onActivated.addListener(function (activeInfo) {
                if (activeInfo.tabId !== originalTab.id) return;

                setTimeout(function () {
                    chrome.tabs.get(activeInfo['tabId'], function (tab) {
                        if (tab && tab.active) {
                            bg.tabs_last_active[tab.id] = Date.now();

                            if (tab.url.indexOf(chrome.extension.getURL("")) !== -1 && bg.config.wake_up_on_focus) {
                                return wakeup();
                            }

                            if (!bg.tabsScreenshots[tab.id]) {
                                bg.updateTabsScreenshots(function () {
                                });
                            }
                        }
                    });
                }, 300);
            });
        });

        // This is used by the ui to notify tabs to wakeup
        chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
            sendResponse({response: "OK"});
            wakeup();
        });

        // Wake up the tab when clicking anywhere
        window.onclick = wakeup;

        // Update the page favicon & the icon image to the body
        generateFaviconUri(params.favIconUrl, function (err, faviconData) {
            if (!err) {
                document.getElementById('faviconLink').href = document.getElementById('faviconImg').src = faviconData;
            }
        });

        // Update the title
        if (params.title) {
            document.title = params.title + ' (Hibernating)';
            document.getElementById("pageTitle").innerText = params.title;
        }

        // Set a screenshot in the background
        var screenshot = bg.tabsScreenshots[params.tabID];
        if (screenshot) {
            document.body.className = 'sc-available';
            document.getElementById('screenshot').style.backgroundImage = "url(" + screenshot + ")";
        }
    }

    /**
     * Get a link to a favicon and generate dataURI of alpha version of it
     * @param url
     * @param callback
     */
    function generateFaviconUri(url, callback) {
        var img = new Image();
        img.onload = function () {
            var canvas, context;
            canvas = window.document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            context = canvas.getContext("2d");
            context.globalAlpha = bg.config.transparent_favicon;
            context.drawImage(img, 0, 0);
            callback(null, canvas.toDataURL());
        };
        img.onerror = function () {
            if (!url) {
                return callback(new Error('unable to generate favicon'));
            }

            // Generate a favicon with the default ico
            generateFaviconUri(null, callback);
        };
        img.src = url || chrome.extension.getURL("src/app/img/default.ico");
    }

    /**
     * Handle wake up functionality
     */
    function wakeup() {
        if (params.originalUrl) {
            if (params.originalUrl.indexOf('chrome://') === 0) {
                window.history.back();
            } else {
                window.location.href = params.originalUrl;
            }
        } else {
            window.history.back();
        }
    }

    init();
}());