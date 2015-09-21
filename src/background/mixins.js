_.mixin({
    compactObject: function (o) {
        _.each(o, function (v, k) {
            if (!v) {
                delete o[k];
            }
        });
        return o;
    },
    digest: function (scope) {
        try {
            scope.$digest();
        } catch (e) {
        }
    },
    activeTabURL: function (callback) {
        chrome.tabs.getSelected(null, function (tab) {
            var result = tab.url.indexOf(chrome.app.getDetails().id) !== -1 ? null : tab.url;
            callback(result);
        });
    },
    toQueryString: function (params) {
        var queryString = _.reduce(
            params,
            function (components, value, key) {
                components.push(key + '=' + encodeURIComponent(value));
                return components;
            },
            []
        ).join('&');
        if (queryString.length > 0) {
            queryString = '?' + queryString;
        }
        return queryString;
    }
});